import time

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from src.model_loader import load_model
from src.questions import QUESTIONS

app = FastAPI(title="AgentGate Decision Server")
model = load_model()

class DecideRequest(BaseModel):
    text: str = Field(..., max_length=65536, description="Input state prompt, capped at 64KB")
    questions: list[str] = Field(..., max_length=20, description="List of question heads")

@app.post("/decide")
async def decide(req: DecideRequest):
    for q in req.questions:
        if q not in QUESTIONS:
            raise HTTPException(status_code=400, detail=f"Unknown question: {q}")
    
    start_time = time.time()
    
    # Process synchronously for the stub. 
    # In production, the actual model serving engine (e.g. vLLM/TGI) handles dynamic batching internally.
    # We deleted the custom FastAPI Batcher to adhere to "Delete any part or process you can".
    answers = await model.predict(req.text, req.questions)
    
    latency_ms = int((time.time() - start_time) * 1000)
    
    return {
        "answers": answers,
        "model_version": model.version,
        "latency_ms": latency_ms
    }

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/model")
async def get_model_info():
    return model.get_tokenizer_info()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.app:app", host="0.0.0.0", port=9000, reload=True)
