import * as moo from "moo";
import { v4 as uuidv4 } from "uuid";
import * as utils from "./utils";

export interface ExecutionJob {
  id: string;
  keyword?: string;
  targets: string[];
  action: string;
}

const lexer = moo.compile({
  keyword: ["!in"],
  target: /https:\/\/\S+/,
  action: { match: /".*?"/, value: (s: string) => s.slice(1, -1) },
  nl: { match: /\n/, lineBreaks: true },
  ws: { match: /[ \t]+/, lineBreaks: false },
});

export function parseCommentForJobs(program: string): ExecutionJob[] {
  //console.log("lexing", program);
  lexer.reset(program);

  const executionJobs: ExecutionJob[] = [];
  let currentToken = lexer.next();

  while (currentToken) {
    if (currentToken.type === "keyword") {
      const keyword = currentToken.value;

      currentToken = lexer.next();
      if (currentToken && currentToken.type === "ws") {
        currentToken = lexer.next();
      }
      if (currentToken && currentToken.type === "target") {
        const target = currentToken.value;

        currentToken = lexer.next();

        if (currentToken && currentToken.type === "ws") {
          currentToken = lexer.next();
        }
        if (currentToken && currentToken.type === "action") {
          const action = currentToken.value;

          executionJobs.push({
            id: uuidv4(),
            keyword,
            targets: [target],
            action,
          });
        }
      }
    }

    currentToken = lexer.next();
  }

  return executionJobs;
}

export function parseFreeTextForJob(inStr: string): ExecutionJob {
  const urls = utils.extractUrls(inStr);

  return {
    id: uuidv4(),
    targets: urls.map((ele) => ele.url),
    action: inStr,
  };
}
