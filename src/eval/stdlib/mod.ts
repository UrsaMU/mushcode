import type { IEvalEngine } from "../context.ts";
import { mathFunctions }     from "./math.ts";
import { stringFunctions }   from "./string.ts";
import { compareFunctions }  from "./compare.ts";
import { logicFunctions }    from "./logic.ts";
import { registerFunctions } from "./register.ts";
import { iterFunctions }     from "./iter.ts";
import { dbFunctions }       from "./db.ts";

/** Register the full standard softcode function library on an engine. */
export function registerStdlib(engine: IEvalEngine): void {
  for (const [n, impl] of Object.entries(mathFunctions))    engine.registerFunction(n, impl);
  for (const [n, impl] of Object.entries(stringFunctions))  engine.registerFunction(n, impl);
  for (const [n, impl] of Object.entries(compareFunctions)) engine.registerFunction(n, impl);
  for (const [n, impl] of Object.entries(logicFunctions))   engine.registerFunction(n, impl);
  for (const [n, impl] of Object.entries(registerFunctions))engine.registerFunction(n, impl);
  for (const [n, impl] of Object.entries(iterFunctions))    engine.registerFunction(n, impl);
  for (const [n, impl] of Object.entries(dbFunctions))      engine.registerFunction(n, impl);
}
