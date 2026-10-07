import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";

// Chat Completions accepts vision in user content, not tool content.
export class NimModel extends ChatOpenAI {
  get profile() { return { ...super.profile, imageInputs: true, imageToolMessage: true, toolCalling: true }; }
  getName() { return "ChatOpenAI"; }
  withConfig(config: any): this {
    const model = new NimModel(this.fields);
    model.defaultOptions = { ...this.defaultOptions, ...config };
    return model as this;
  }
  async _generate(messages: BaseMessage[], options: any, runManager?: CallbackManagerForLLMRun) {
    const images: any[] = [];
    const mapped = messages.map(message => {
      if (!ToolMessage.isInstance(message)) return message;
      const media = message.contentBlocks.filter(block => block.type === "image");
      if (!media.length) return message;
      images.push(...media.map((block: any) => ({ type: "image_url", image_url: { url: block.url ?? `data:${block.mimeType ?? block.mime_type};base64,${block.data}` } })));
      return new ToolMessage({ tool_call_id: message.tool_call_id, name: message.name,
        content: message.contentBlocks.filter(block => block.type === "text") });
    });
    if (images.length) mapped.push(new HumanMessage({ content: [{ type: "text", text: "Actual image bytes returned by the inspection tool:" }, ...images] }));
    return super._generate(mapped, options, runManager);
  }
}
