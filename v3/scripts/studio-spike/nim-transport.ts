import assert from "node:assert/strict";

// Isolated, sequential, non-streaming spike. Durable history recovery belongs to M1.
// ChatOpenAI 1.6.2 receives reasoning_content but drops it when serializing history.
export function nimTransport(send: typeof fetch = fetch): typeof fetch {
  const reasoning = new Map<string, string>();
  return async (input, init) => {
    assert.equal(new URL(String(input)).origin, "https://integrate.api.nvidia.com");
    const body = JSON.parse(String(init?.body));
    assert.ok(!body.stream, "NIM spike requires non-streaming reasoning preservation");
    for (const message of body.messages) {
      if (message.role === "assistant" && message.tool_calls?.length) {
        const saved = reasoning.get(message.tool_calls[0].id);
        assert.notEqual(saved, undefined, "Missing Kimi reasoning history; stop before submission");
        message.reasoning_content = saved;
      }
    }
    const response = await send(input, { ...init, body: JSON.stringify(body) });
    if (response.ok) {
      const result = await response.clone().json();
      const message = result.choices?.[0]?.message;
      if (message?.tool_calls?.length) {
        assert.equal(typeof message.reasoning_content, "string", "NIM omitted required reasoning history");
        for (const call of message.tool_calls) reasoning.set(call.id, message.reasoning_content);
      }
    }
    return response;
  };
}
