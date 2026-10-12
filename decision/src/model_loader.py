import asyncio
from typing import Any
import os

from src.questions import QUESTIONS

class UnslothDecisionModel:
    def __init__(self, model_name="unsloth/Qwen3.5-0.8B"):
        self.version = model_name
        
        # In a real environment, we would load the FastDecisionModel here.
        # Since this might be run on a machine without a GPU during development,
        # we try to load it, and fallback to a stub if Unsloth or CUDA is unavailable.
        self._has_unsloth = False
        self.model = None
        self.tokenizer = None
        
        if os.environ.get("USE_UNSLOTH") == "1":
            try:
                from unsloth import FastDecisionModel
                import torch
                custom_checkpoint = os.environ.get("DECISION_MODEL_PATH", "/home/mohit/projects/agentgate/decision/qwen-decisions")
                if os.path.exists(custom_checkpoint):
                    load_path = custom_checkpoint
                    print(f"Loading fine-tuned Unsloth checkpoint: {load_path}...")
                else:
                    load_path = model_name
                    print(f"Loading Unsloth FastDecisionModel: {load_path}...")
                self.version = load_path
                self.model, self.tokenizer = FastDecisionModel.from_pretrained(
                    load_path,
                    max_seq_length=2048,
                    load_in_4bit=True
                )
                FastDecisionModel.for_inference(self.model)
                print("Unsloth model loaded successfully.")
                self._has_unsloth = True
            except Exception as e:
                import traceback
                print(f"WARNING: Failed to load Unsloth ({e}). Falling back to Stub behavior.")
                traceback.print_exc()
        else:
            print("USE_UNSLOTH not set. Starting in STUB mode.")

    async def predict(self, text: str, questions: list[str]) -> dict[str, Any]:
        if not self._has_unsloth:
            return await self._stub_predict(text, questions)
            
        from unsloth import FastDecisionModel
        
        # Map our QUESTIONS format to the format Unsloth expects
        unsloth_questions = {}
        for q in questions:
            if q in QUESTIONS:
                q_def = dict(QUESTIONS[q])
                if q_def["type"] == "yes/no":
                    q_def["type"] = "noul" # Clef boolean question type is 'noul'
                unsloth_questions[q] = q_def
                
        # FastDecisionModel.predict is blocking, run in threadpool
        loop = asyncio.get_running_loop()
        answers = await loop.run_in_executor(
            None,
            lambda: FastDecisionModel.predict(
                self.model,
                self.tokenizer,
                text,
                unsloth_questions
            )
        )
        
        # Post-process Unsloth answers back to our expected JSON schema
        formatted_answers = {}
        for q in questions:
            if q in answers and q in QUESTIONS:
                val = answers[q]["answer"]
                probs = answers[q].get("probabilities", {})
                
                # Unsloth uses True/False or "true"/"false" for noul types, we map back to "yes"/"no"
                if QUESTIONS[q]["type"] == "yes/no":
                    mapped_ans = "yes" if (val is True or str(val).lower() == "true") else "no"
                    mapped_probs = {}
                    for k, v in probs.items():
                        if k is True or str(k).lower() == "true":
                            mapped_probs["yes"] = float(v)
                        elif k is False or str(k).lower() == "false":
                            mapped_probs["no"] = float(v)
                    if not mapped_probs:
                        mapped_probs = {"yes": 0.5, "no": 0.5}
                    
                    formatted_answers[q] = {
                        "answer": mapped_ans,
                        "probabilities": mapped_probs
                    }
                else:
                    formatted_answers[q] = {
                        "answer": val,
                        "probabilities": probs
                    }

        return formatted_answers

    async def _stub_predict(self, text: str, questions: list[str]) -> dict[str, Any]:
        """Simulate a forward pass returning fixed probabilities."""
        await asyncio.sleep(0.04)
        
        answers = {}
        is_evil = "evil" in text.lower()
        
        for q in questions:
            if q not in QUESTIONS: continue
            
            if q == "untrusted_influence":
                if is_evil:
                    answers[q] = {"answer": "likely", "probabilities": {"none": 0.05, "possible": 0.15, "likely": 0.80}}
                else:
                    answers[q] = {"answer": "none", "probabilities": {"none": 0.90, "possible": 0.08, "likely": 0.02}}
            elif q == "goal_alignment":
                if is_evil:
                    answers[q] = {"answer": "misaligned", "probabilities": {"aligned": 0.1, "tangential": 0.2, "misaligned": 0.7}}
                else:
                    answers[q] = {"answer": "aligned", "probabilities": {"aligned": 0.85, "tangential": 0.1, "misaligned": 0.05}}
            elif q == "reversibility":
                if "delete" in text.lower():
                    answers[q] = {"answer": "irreversible", "probabilities": {"reversible": 0.1, "costly": 0.2, "irreversible": 0.7}}
                else:
                    answers[q] = {"answer": "reversible", "probabilities": {"reversible": 0.8, "costly": 0.15, "irreversible": 0.05}}
            elif q == "external_send":
                if is_evil or "send" in text.lower() or "mail" in text.lower():
                    answers[q] = {"answer": "yes", "probabilities": {"yes": 0.88, "no": 0.12}}
                else:
                    answers[q] = {"answer": "no", "probabilities": {"yes": 0.05, "no": 0.95}}
        return answers
        
    def get_tokenizer_info(self):
        return {"max_tokens": 2048, "model_name": self.version, "is_stub": not self._has_unsloth}

def load_model():
    return UnslothDecisionModel()
