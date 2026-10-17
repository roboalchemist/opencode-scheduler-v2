import { z } from "zod"
import SchedulerPlugin from "opencode-scheduler"

// One engine per process: OpenCode loads a plugin once per location/workspace,
// and repeated loads would register duplicate tool sets.
let instanceActive = false

export default {
  id: "opencode-scheduler-v2",
  setup: async (context: any) => {
    if (instanceActive) {
      console.error("[scheduler-v2] duplicate instance in this process - skipping (singleton)")
      return () => {}
    }
    instanceActive = true
    try {
      const hooks = await (SchedulerPlugin as any)()
      const toolDefs: Record<string, any> = hooks?.tool ?? {}
      await context.tool.transform((draft: any) => {
        for (const [name, def] of Object.entries<any>(toolDefs)) {
          let input: any
          try {
            input = z.toJSONSchema(z.object(def.args ?? {}))
          } catch {
            input = { type: "object", properties: {}, additionalProperties: true }
          }
          draft.add({
            name,
            description: def.description,
            input,
            execute: async (args: any, toolContext: any) => {
              const r = await def.execute(args, toolContext)
              return typeof r === "string" ? { content: r } : r ?? { content: "" }
            },
          })
        }
      })
    } catch (e) {
      console.error("[scheduler-v2] setup failed:", e)
      instanceActive = false
    }
    return () => { instanceActive = false }
  },
}
