import { Configuration, OpenAIApi } from "openai";
import Config from "./config";

const configuration = new Configuration({
  apiKey: Config.openApiKey,
});
const openai = new OpenAIApi(configuration);

export default openai;
