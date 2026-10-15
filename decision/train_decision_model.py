import os
import sys

os.environ["TORCHDYNAMO_DISABLE"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

import torch

try:
    torch._dynamo.config.disable = True
    torch._dynamo.config.suppress_errors = True
except Exception:
    pass

try:
    from datasets import load_dataset
    from transformers import TrainingArguments
    from unsloth import DecisionTrainer, FastDecisionModel, is_bfloat16_supported
except ImportError as e:
    print(f"Dependencies not ready yet: {e}")
    sys.exit(1)

def main():
    print("=== Training Unsloth Decision Model on Qwen3.5-0.8B ===")
    print("VRAM limit optimized for 4GB RTX 2050...")

    model_name = "unsloth/Qwen3.5-0.8B"
    
    # 1. Load Base Model in 4-bit
    print(f"Loading {model_name}...")
    model, tokenizer = FastDecisionModel.from_pretrained(
        model_name = model_name,
        max_seq_length = 2048,
        load_in_4bit = True,
    )

    # 2. Add LoRA adapter + Clef Decision Head
    print("Initializing LoRA + Clef head...")
    model = FastDecisionModel.get_peft_model(
        model,
        r = 16,
        lora_alpha = 16,
        lora_dropout = 0,
        use_gradient_checkpointing = "unsloth",
        random_state = 3407,
    )

    # 3. Load dataset
    print("Loading LocalLLaMA/typed-decisions dataset...")
    dataset = load_dataset("LocalLLaMA/typed-decisions", "all", split = "train")
    items, report = FastDecisionModel.build_dataset(dataset, tokenizer, model)
    print(f"Skipped {report.get('skipped', 0)} of {report.get('total', len(items))} decisions")

    train_items, eval_items = FastDecisionModel.split_holdout(items, seed = 3407)

    # 4. Train
    print("Starting fine-tuning (60 fast calibration steps)...")
    trainer = DecisionTrainer(
        model = model,
        processing_class = tokenizer,
        train_dataset = train_items,
        eval_dataset = eval_items,
        args = TrainingArguments(
            per_device_train_batch_size = 2,
            gradient_accumulation_steps = 8,
            max_steps = 60, # Unsloth recommended 60-step fast run
            learning_rate = 2e-4,
            lr_scheduler_type = "cosine",
            warmup_steps = 10,
            weight_decay = 0.01,
            bf16 = is_bfloat16_supported(),
            fp16 = not is_bfloat16_supported(),
            logging_steps = 10,
            output_dir = "outputs",
            report_to = "none",
            seed = 3407,
            torch_compile = False,
        ),
    )

    trainer.train()

    # 5. Calibrate probabilities
    print("Calibrating probabilities on holdout set...")
    metrics = FastDecisionModel.calibrate(model, tokenizer, eval_items)
    print(f"Calibration Metrics: {metrics}")

    # 6. Save model checkpoint
    save_dir = os.environ.get("SAVE_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "qwen-decisions"))
    print(f"Saving calibrated model to {save_dir}...")
    model.save_pretrained(save_dir)
    tokenizer.save_pretrained(save_dir)
    print("Done! Model is ready for serving.")

if __name__ == "__main__":
    main()
