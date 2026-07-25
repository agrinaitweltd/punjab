import type { AssignedTask } from "../types"
import { databaseService } from "./databaseService"
import { supabaseReady } from "../lib/supabase"

let tasks: AssignedTask[] = []

export async function getAssignedTasks(): Promise<AssignedTask[]> {
  if (supabaseReady) return databaseService.getAssignedTasks()
  await new Promise(r => setTimeout(r, 80))
  return [...tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function createAssignedTask(input: Omit<AssignedTask, "id" | "createdAt" | "status">): Promise<AssignedTask> {
  if (supabaseReady) return databaseService.createAssignedTask(input)
  await new Promise(r => setTimeout(r, 80))
  const task: AssignedTask = { ...input, id: `task-${Date.now()}`, status: "Open", createdAt: new Date().toISOString() }
  tasks.push(task)
  return task
}

export async function updateAssignedTaskStatus(id: string, status: AssignedTask["status"]): Promise<boolean> {
  if (supabaseReady) return databaseService.updateAssignedTaskStatus(id, status)
  await new Promise(r => setTimeout(r, 80))
  const idx = tasks.findIndex(t => t.id === id)
  if (idx === -1) return false
  tasks[idx] = { ...tasks[idx], status }
  return true
}
