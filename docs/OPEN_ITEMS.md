# OPEN_ITEMS

## Verification needed
- `[verify]` The exact answer field names for `noul` probabilities and the Unsloth Decision API request format. (Assumed bool/yes/no per HLD for now).
- `[verify]` If batched prediction is not exposed in FastDecisionModel.predict.
- `[verify]` Training truncates from the end of the input and keeps questions and options (from Unsloth docs).
- `[verify]` Exact Unsloth fine-tuning entry point and dataset row format for Laya checkpoints.
- `[verify]` Untrusted influence rules based on benchmark API ground-truth calls.
- `[verify]` The model-name string accepted by `FastDecisionModel.from_pretrained`.

## Deferred to Phase 2
- MCP proxy mode (acting as MCP server/client directly via the protocol).
- Approvals queue and its UI.
- Policy editor and replay UI.
- Models/calibration page.
- Metrics page.
- SSE live streaming for dashboard feeds.
- Real model training and `ml/` pipeline implementation.
- Benchmark runs (`bench/`).
- Public docs site.
