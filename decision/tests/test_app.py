from fastapi.testclient import TestClient

from src.app import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_model():
    response = client.get("/model")
    assert response.status_code == 200
    data = response.json()
    assert data["max_tokens"] == 2048
    assert "model_name" in data

def test_decide():
    with TestClient(app) as client:
        response = client.post("/decide", json={
            "text": "Please run this benign task.",
            "questions": ["untrusted_influence", "external_send"]
        })
        assert response.status_code == 200
        data = response.json()
        assert "answers" in data
        assert "untrusted_influence" in data["answers"]
        assert "external_send" in data["answers"]
        assert "model_version" in data
