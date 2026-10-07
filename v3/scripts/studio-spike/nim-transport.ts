import assert from "node:assert/strict";

// Isolated, sequential, non-streaming spike. Durable history recovery belongs to M1.
// ChatOpenAI 1.6.2 receives reasoning_content but drops it when serializing history.
export function nimTransport(send: typeof fetch = fetch): typeof fetch {
  const history: any[] = [];
  return async (input, init) => {
    assert.equal(new URL(String(input)).origin, "https://integrate.api.nvidia.com");
    const body = JSON.parse(String(init?.body));
    assert.ok(!body.stream, "NIM spike requires non-streaming reasoning preservation");
    let assistantIndex = 0;
    for (const message of body.messages) {
      if (message.role === "assistant" && message.tool_calls?.length) {
        const saved = history[assistantIndex++];
        assert.ok(saved, "Missing Kimi reasoning history; stop before submission");
        assert.deepEqual(message.tool_calls.map((c: any) => c.id), saved.tool_calls.map((c: any) => c.id), "Kimi history mismatch");
        Object.assign(message, saved); // Preserve complete original assistant message, including empty content.
      }
    }
    const response = await send(input, { ...init, body: JSON.stringify(body) });
    if (response.ok) {
      const result = await response.clone().json();
      const message = result.choices?.[0]?.message;
      if (message?.tool_calls?.length) {
        assert.ok(typeof message.reasoning_content === "string" || result.usage?.completion_tokens_details?.reasoning_tokens === 0, "NIM omitted reasoning despite nonzero/unknown reasoning usage");
        history.push(message);
      }
    }
    return response;
  };
}
