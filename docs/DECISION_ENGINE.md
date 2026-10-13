# Unsloth Decision Engine & Machine Learning Architecture

This document describes the design, training pipeline, and serving architecture of the Machine Learning decision engine in AgentGate.

---

## 1. Why Decision Models Beat Text Generation

Standard AI guardrails invoke a large language model (e.g., via vLLM, OpenAI, or Ollama) with a prompt like:
> *"Does this action look safe? Output a JSON object with verdict and probability."*

This approach introduces three fatal flaws for an authorization gateway:
1. **Autoregressive Generation Latency:** Generating text token-by-token takes **200ms–800ms**. This latency compounds on every single agent tool call, rendering agents sluggish.
2. **Hallucinated Probabilities:** Generative LLMs are notoriously uncalibrated. When asked for a numeric risk score, they hallucinate arbitrary numbers (often outputting 0.9 or 0.99 for everything).
3. **Severe VRAM Demands:** Generative inference engines require large KV-cache allocations in GPU memory. On consumer GPUs (like an NVIDIA RTX 2050 with 4GB VRAM), vLLM instantly crashes with Out-Of-Memory (OOM) errors.

### The Unsloth Solution: The Clef Multi-Head Classifier
Unsloth converts open-weight base models (such as `Qwen3.5-0.8B` or `Gemma-4`) into **Decision Models**:
* **Zero Autoregressive Generation:** The model executes a **single forward pass** through the transformer encoder.
* **Direct Choice Scoring:** A tiny classification head (the Clef head) sits on top of the transformer's hidden states, projecting directly to the logits of the specific choices for all questions simultaneously.
* **Calibrated Outputs:** The head is trained with cross-entropy loss against ground truth safety decisions and calibrated (`FastDecisionModel.calibrate`), ensuring that an output probability of `0.80` represents true statistical confidence.
* **Blazing Latency & Low VRAM:** Inference completes in **sub-40ms** and fits in **~2.5GB of VRAM** in 4-bit precision.

---

## 2. Decision Heads Specification

AgentGate evaluates four simultaneous risk heads for every tool invocation:

| Head Name | Type | Options | Description |
|---|---|---|---|
| `untrusted_influence` | Choice | `none`, `possible`, `likely` | Did untrusted text (e.g., web scrapings, emails) instruct the agent to run this tool? |
| `goal_alignment` | Choice | `aligned`, `tangential`, `misaligned` | Does this specific tool invocation directly serve the user's stated session goal? |
| `reversibility` | Choice | `reversible`, `costly`, `irreversible` | Can the outcome of this action be undone (e.g., reading a file vs `rm -rf`)? |
| `external_send` | Boolean | `yes`, `no` | Does this tool call exfiltrate or send data outside the local organization boundary? |

---

## 3. Training & Calibration Pipeline

The fine-tuning pipeline is implemented in [`decision/train_decision_model.py`](file:///home/mohit/projects/agentgate/decision/train_decision_model.py).

### How It Works:
1. **Model Loading:** Loads `unsloth/Qwen3.5-0.8B` in 4-bit quantized mode using `bitsandbytes`.
2. **LoRA + Head Initialization:** Attaches Low-Rank Adaptation matrices ($r=16, \alpha=16$) to attention projections and adds the Clef decision head.
3. **Dataset Loading:** Pulls the `LocalLLaMA/typed-decisions` benchmark dataset from Hugging Face.
4. **Training:** Trains via Unsloth's `DecisionTrainer` using a cosine learning rate scheduler ($2 \times 10^{-4}$) for 60 rapid calibration steps.
5. **Probability Calibration:** Calls `FastDecisionModel.calibrate(model, tokenizer, eval_items)` to minimize Expected Calibration Error (ECE).
6. **Artifact Export:** Saves the LoRA adapter weights and tokenizer to `decision/qwen-decisions/`.

### Running the Training Script Locally:
To train the model on your local NVIDIA GPU:
```bash
/home/mohit/projects/agentgate/decision/.venv_unsloth/bin/python decision/train_decision_model.py
```

---

## 4. Serving Architecture

The FastAPI decision server (`decision/src/app.py`) dynamically wraps the model:
* When `USE_UNSLOTH=1`: Loads the fine-tuned model via `FastDecisionModel.from_pretrained()` and executes inference through a background threadpool to avoid blocking FastAPI's async event loop.
* When `USE_UNSLOTH=0`: Falls back to `StubModel`, simulating calibrated distributions with 40ms sleep for rapid local prototyping without requiring a GPU.

---

## 5. Hugging Face Hub Integration

The trained model checkpoint and Clef classification heads are published on Hugging Face Hub:
* **Hugging Face Repository**: [`codeload/agentgate-qwen-0.8b`](https://huggingface.co/codeload/agentgate-qwen-0.8b)

To run the decision service against the remote Hugging Face weights:
```bash
export USE_UNSLOTH=1
export DECISION_MODEL_PATH="codeload/agentgate-qwen-0.8b"
```

To test standalone inference with Unsloth:
```python
from unsloth import FastDecisionModel

model, tokenizer = FastDecisionModel.from_pretrained(
    "codeload/agentgate-qwen-0.8b",
    max_seq_length=2048,
    load_in_4bit=True,
)
FastDecisionModel.for_inference(model)
```
