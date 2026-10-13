import asyncio
import json
import os
from typing import Any

import torch

from src.questions import QUESTIONS


class DecisionModel:
    def __init__(self, model_name: str = "codeload/agentgate-qwen-0.8b"):
        self.version = model_name
        self.backend = "unknown"
        self.device = "unknown"
        self.model = None
        self.tokenizer = None

        custom_checkpoint = os.environ.get("DECISION_MODEL_PATH")
        if not custom_checkpoint:
            local_default = os.path.abspath(
                os.path.join(os.path.dirname(__file__), "..", "qwen-decisions")
            )
            if os.path.exists(local_default):
                custom_checkpoint = local_default
            else:
                custom_checkpoint = model_name

        load_path = custom_checkpoint
        self.version = load_path

        has_cuda = torch.cuda.is_available() and os.environ.get("FORCE_CPU") != "1"
        if has_cuda:
            try:
                from unsloth import FastDecisionModel

                print(f"Loading Unsloth checkpoint on GPU: {load_path}...")
                self.model, self.tokenizer = FastDecisionModel.from_pretrained(
                    load_path,
                    max_seq_length=2048,
                    load_in_4bit=True,
                )
                FastDecisionModel.for_inference(self.model)
                self.backend = "unsloth_gpu"
                self.device = "cuda"
                print("Unsloth model loaded successfully on GPU.")
                return
            except Exception as e:
                import traceback

                print(f"WARNING: Failed to load Unsloth on GPU ({e}). Falling back to CPU transformers.")
                traceback.print_exc()

        # Fallback to standard PyTorch CPU via Hugging Face transformers
        self._load_cpu(load_path)

    def _load_cpu(self, load_path: str):
        from peft import PeftModel
        from safetensors.torch import load_file
        from transformers import AutoModelForCausalLM, AutoTokenizer

        from src.clef import ClefModel, JointSchemaHead

        if not os.path.isdir(load_path):
            from huggingface_hub import snapshot_download

            print(f"Downloading checkpoint from Hugging Face Hub: {load_path}...")
            folder = snapshot_download(load_path)
        else:
            folder = load_path

        print(f"Loading checkpoint on CPU from {folder}...")
        self.tokenizer = AutoTokenizer.from_pretrained(folder)

        base_model = "unsloth/Qwen3.5-0.8B"
        unsloth_cfg_file = os.path.join(folder, "unsloth_decision_config.json")
        if os.path.exists(unsloth_cfg_file):
            with open(unsloth_cfg_file, "r", encoding="utf-8") as f:
                base_model = json.load(f).get("base_model", base_model)
        elif os.path.exists(os.path.join(folder, "adapter_config.json")):
            with open(os.path.join(folder, "adapter_config.json"), "r", encoding="utf-8") as f:
                base_model = json.load(f).get("base_model_name_or_path", base_model)

        print(f"Loading base language model on CPU: {base_model}...")
        backbone = AutoModelForCausalLM.from_pretrained(base_model, dtype=torch.float32)

        adapter_config_path = os.path.join(folder, "adapter_config.json")
        if os.path.exists(adapter_config_path):
            print(f"Applying LoRA adapter from {folder}...")
            backbone = PeftModel.from_pretrained(backbone, folder)

        head_config_path = os.path.join(folder, "joint_head_config.json")
        head_weights_path = os.path.join(folder, "joint_head.safetensors")
        with open(head_config_path, "r", encoding="utf-8") as f:
            head_config = json.load(f)

        print(f"Loading JointSchemaHead from {head_weights_path}...")
        head = JointSchemaHead(**head_config)
        head.load_state_dict(load_file(head_weights_path), strict=True)
        head = head.to(device="cpu", dtype=torch.float32)

        self.model = ClefModel(backbone, head).eval()
        self.backend = "transformers_cpu"
        self.device = "cpu"
        print("Real PyTorch CPU neural model loaded successfully.")

    async def predict(self, text: str, questions: list[str]) -> dict[str, Any]:
        if not self.model or not self.tokenizer:
            raise RuntimeError("Decision model is not initialized")

        unsloth_questions = {}
        for q in questions:
            if q in QUESTIONS:
                q_def = dict(QUESTIONS[q])
                if q_def["type"] == "yes/no":
                    q_def["type"] = "noul"
                unsloth_questions[q] = q_def

        loop = asyncio.get_running_loop()

        if self.backend == "unsloth_gpu":
            from unsloth import FastDecisionModel

            raw_answers = await loop.run_in_executor(
                None,
                lambda: FastDecisionModel.predict(
                    self.model,
                    self.tokenizer,
                    text,
                    unsloth_questions,
                ),
            )
        elif self.backend == "transformers_cpu":
            from src.clef import collate_records, encode_record

            def _cpu_forward():
                req = {"state": text, "questions": unsloth_questions}
                encoded = encode_record(self.tokenizer, req, max_length=2048)
                batch = collate_records([encoded], self.tokenizer.pad_token_id, torch.device("cpu"))
                with torch.no_grad():
                    logits = self.model(batch)[0]

                cpu_out = {}
                for question, question_logits in zip(encoded.questions, logits):
                    probs = dict(zip(question.option_ids, question_logits.float().softmax(-1).tolist()))
                    is_noul = unsloth_questions[question.question_id]["type"] == "noul"
                    if is_noul:
                        ans_val = probs.get("true", 0.0) >= 0.5
                    else:
                        ans_val = max(probs, key=probs.get)
                    cpu_out[question.question_id] = {
                        "answer": ans_val,
                        "probabilities": probs,
                    }
                return cpu_out

            raw_answers = await loop.run_in_executor(None, _cpu_forward)
        else:
            raise RuntimeError(f"Unknown model backend: {self.backend}")

        # Post-process answers to expected schema
        formatted_answers = {}
        for q in questions:
            if q in raw_answers and q in QUESTIONS:
                item = raw_answers[q]
                val = item.get("answer")
                probs = item.get("probabilities", {})

                if QUESTIONS[q]["type"] == "yes/no":
                    is_yes = val is True or str(val).lower() in ("true", "yes")
                    mapped_probs = {}
                    for k, v in probs.items():
                        k_str = str(k).lower()
                        if k_str in ("true", "yes"):
                            mapped_probs["yes"] = float(v)
                        elif k_str in ("false", "no"):
                            mapped_probs["no"] = float(v)
                    if not mapped_probs:
                        mapped_probs = {"yes": 0.5, "no": 0.5}

                    formatted_answers[q] = {
                        "answer": "yes" if is_yes else "no",
                        "probabilities": mapped_probs,
                    }
                else:
                    formatted_answers[q] = {
                        "answer": str(val),
                        "probabilities": {str(k): float(v) for k, v in probs.items()},
                    }

        return formatted_answers

    def get_tokenizer_info(self):
        return {
            "max_tokens": 2048,
            "model_name": self.version,
            "is_stub": False,
            "device": self.device,
            "backend": self.backend,
        }


def load_model():
    return DecisionModel()
