import assert from "node:assert/strict";

// One transport per worker, sequential within that worker. Durable history recovery remains a gate.
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
      const choice = result.choices?.[0], message = choice?.message;
      assert.ok(message?.role === "assistant", "NIM_MALFORMED_RESPONSE: missing assistant message");
      assert.notEqual(choice.finish_reason, "length", "NIM_TRUNCATED_RESPONSE: stop; do not repair partial tool calls");
      if (body.tool_choice === "required" && body.tools?.length) assert.ok(message.tool_calls?.length, "NIM_REQUIRED_TOOL_MISSING: provider returned no tool; stop before graph acceptance");
      for (const call of message.tool_calls ?? []) {
        assert.ok(typeof call.id === "string" && call.id && call.type === "function" && body.tools?.some((t: any) => t.function?.name === call.function?.name), "NIM_INVALID_TOOL_CALL");
        assert.ok(typeof call.function.arguments === "string", "NIM_INVALID_TOOL_ARGUMENTS");
        const args = JSON.parse(call.function.arguments); assert.ok(args && typeof args === "object" && !Array.isArray(args), "NIM_INVALID_TOOL_ARGUMENTS");
      }
      if (message?.tool_calls?.length) {
        assert.ok(typeof message.reasoning_content === "string" || result.usage?.completion_tokens_details?.reasoning_tokens === 0, "NIM omitted reasoning despite nonzero/unknown reasoning usage");
        history.push(message);
      }
    }
    return response;
  };
}
