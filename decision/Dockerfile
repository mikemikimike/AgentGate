FROM pytorch/pytorch:2.2.0-cuda12.1-cudnn8-runtime

WORKDIR /app

# Install build dependencies for Unsloth and xformers
RUN apt-get update && apt-get install -y git build-essential

# Install Unsloth and serving dependencies
RUN pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
RUN pip install fastapi uvicorn pydantic datasets xformers trl peft accelerate bitsandbytes

COPY . .

CMD ["uvicorn", "src.app:app", "--host", "0.0.0.0", "--port", "9000"]
