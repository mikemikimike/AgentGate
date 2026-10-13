#!/usr/bin/env python3
"""
AgentGate Model Uploader to Hugging Face Hub

Uploads the trained Unsloth decision model adapter and Clef head 
from `decision/qwen-decisions/` to Hugging Face Hub.

Usage:
    export HF_TOKEN="your_huggingface_token"
    python decision/upload_to_hf.py --repo codeload/agentgate-qwen-0.8b
"""

import argparse
import os
import sys


def main():
    parser = argparse.ArgumentParser(description="Upload AgentGate decision model to Hugging Face Hub")
    parser.add_argument("--repo", type=str, required=True, help="Hugging Face repo ID, e.g., codeload/agentgate-qwen-0.8b")
    parser.add_argument("--path", type=str, default=None, help="Local path to model weights (defaults to decision/qwen-decisions)")
    parser.add_argument("--private", action="store_true", help="Set repository to private")
    args = parser.parse_args()

    local_dir = args.path or os.path.abspath(os.path.join(os.path.dirname(__file__), "qwen-decisions"))
    if not os.path.exists(local_dir):
        print(f"Error: Model directory not found at {local_dir}")
        sys.exit(1)

    print(f"Preparing to upload {local_dir} to Hugging Face Hub: {args.repo}...")

    try:
        from huggingface_hub import HfApi
    except ImportError:
        print("Installing huggingface_hub...")
        os.system("pip install --quiet huggingface_hub")
        from huggingface_hub import HfApi

    token = os.environ.get("HF_TOKEN")
    api = HfApi(token=token)

    try:
        api.create_repo(repo_id=args.repo, repo_type="model", private=args.private, exist_ok=True)
        print(f"Repository {args.repo} created/verified.")
        
        print("Uploading files...")
        api.upload_folder(
            folder_path=local_dir,
            repo_id=args.repo,
            repo_type="model",
        )
        print("\nUpload Complete!")
        print(f"Model is live at: https://huggingface.co/{args.repo}")
        print("\nTo use this model in AgentGate, set:")
        print(f"  export DECISION_MODEL_PATH=\"{args.repo}\"")
    except Exception as e:
        print(f"\nUpload failed: {e}")
        print("\nTip: Make sure you are logged in or have HF_TOKEN set:")
        print("  1. Run `hf auth login` OR")
        print("  2. Set `export HF_TOKEN=hf_...` (with write permissions)")
        sys.exit(1)

if __name__ == "__main__":
    main()
