import type { Command } from "commander";
import { registerGrcCli } from "../grc-cli.js";

export function registerGrcCommand(program: Command) {
  registerGrcCli(program);
}
