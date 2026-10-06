import assert from "node:assert/strict";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, BaseMessage } from "@langchain/core/messages";

// Explicit isolated mock: proves harness mechanics, never creative understanding.
export class ScriptedModel extends BaseChatModel {
  modelName = "gpt-5.6-sol";
  calls: BaseMessage[][] = [];
  toolNames: string[] = [];
  constructor(private script: ((messages: BaseMessage[]) => AIMessage)[]) { super({}); }
  getName() { return "ChatOpenAI"; }
  _llmType() { return "isolated-scripted-test"; }
  bindTools(tools: any[]) { this.toolNames = tools.map(t => t.name); return this; }
  async _generate(messages: BaseMessage[]) {
    this.calls.push(messages);
    const step = this.script.shift();
    assert.ok(step, "Harness called the model after expected termination");
    return { generations: [{ text: "", message: step(messages) }] };
  }
}
export const call = (name: string, args: object, id = name) => new AIMessage({ content: "", tool_calls: [{ name, args, id, type: "tool_call" }] });
