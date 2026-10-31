\# SARVAM\_NOTES (verified 31 Oct 2026, 09:00 to 09:08 IST)  
Base URL: https\://api.sarvam.ai  
Auth: header api-subscription-key works on all three endpoints. Never log it.

\#\# STT  
\- POST /speech-to-text, multipart: file, model, mode  
\- Model: saaras:v3, mode transcribe. Codemix not compared yet.  
\- Response: request\_id, transcript, language\_code, language\_probability  
\- Latency: about 1.3 s (clean TTS audio, not a real mic)  
\- Audio: WAV 16 kHz mono. Do not rely on other formats.

\#\# Chat  
\- POST /v1/chat/completions (OpenAI-style body)  
\- sarvam-30b is DEPRECATED. Use sarvam-105b. sarvam-105b-conversations also exists, untested.  
\- Output: clean JSON with a leading newline. No think tags, no code fences. Trim and strip fences anyway.  
\- message.reasoning\_content was null; reasoning is hidden but counted: 456 of 476 completion tokens.  
\- Set max\_tokens 2000 or the JSON can be cut off.  
\- Latency: about 2.8 s. Show the rules result first and let the AI result upgrade it.

\#\# TTS  
\- POST /text-to-speech, JSON: text, target\_language\_code (hi-IN), model  
\- Model: bulbul:v3. Default speaker works; do not send a speaker unless SARVAM\_TTS\_SPEAKER is set.  
\- Response: { request\_id, audios: \[base64 WAV\] }  
\- Latency: about 1.3 s

\#\# Docs  
\- MCP: https\://docs.sarvam.ai/\_mcp/server  
\- Full text: https\://docs.sarvam.ai/llms-full.txt  
