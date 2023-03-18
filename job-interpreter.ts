import * as moo from "moo";
import { v4 as uuidv4 } from "uuid";

export interface ExecutionJob {
  id: string;
  keyword: string;
  target: string;
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

          executionJobs.push({ id: uuidv4(), keyword, target, action });
        }
      }
    }

    currentToken = lexer.next();
  }

  return executionJobs;
}
