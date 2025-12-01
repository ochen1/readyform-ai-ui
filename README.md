# ReadyFormAI

ReadyFormAI turns filling in PDF forms into a conversation. It aims to make
public services more accessible to visually impaired citizens, as accessing said
services is largely done through submitting digital PDF forms. Our accessible
interface is compatible with screen-readers and uses an AI-powered voice
assistant that is capable for filling out the entire form with you. Once
complete, the interface allows you to export the filled in PDF form.

ReadyFormAI can be run with entirely open-source components. Specifically, we
recommend using:

 - [Ultravox](https://huggingface.co/collections/fixie-ai/ultravox-v05) the
   voice to text model
 - [UltraVAD](https://huggingface.co/collections/fixie-ai/ultravad) to allow
   users to interrupt the conversation naturally.
 - [Kokoro TTS](https://huggingface.co/hexgrad/Kokoro-82M) for generating the
   vocals in the reply.

However, for ease of testing, this demo version uses Ultravox's cloud API. This
uses the same open-source pipeline, but makes it much easier to test out! New
accounts get 30 minutes of call time for free. We recommend switching to the
open source components in production, to keep user data secure and private.

## Getting Started

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Sign up to [Ultravox cloud](https://app.ultravox.ai/) and obtain an api key from
the dashboard. Fill in the `VITE_ULTRAVOX_API_KEY` in `.env` with your key.

For ease of setup, our interface currently uses
[aistudio](https://aistudio.google.com/app/apikey) for enhancing form context
(such as reading units), grab a free api key from aistudio and fill it in
`.env`. You can also change out the endpoint (eg. vLLM) to host this model
locally.

Install the dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`. Open this URL in your browser to start using ReadyFormAI.
