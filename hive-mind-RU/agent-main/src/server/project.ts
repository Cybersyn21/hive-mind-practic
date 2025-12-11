import { Hono } from "hono"
import { describeRoute } from "hono-openapi"
import { resolver } from "hono-openapi"
import { Instance } from "../project/instance"
import { Project } from "../project/project"

// Роутер для HTTP API работы с проектами
// Предоставляет эндпоинты для получения списка проектов и текущего проекта
export const ProjectRoute = new Hono()
  .get(
    "/",
    describeRoute({
      description: "List all projects",
      operationId: "project.list",
      responses: {
        200: {
          description: "List of projects",
          content: {
            "application/json": {
              schema: resolver(Project.Info.array()),
            },
          },
        },
      },
    }),
    // Получает список всех проектов
    async (c) => {
      const projects = await Project.list()
      return c.json(projects)
    },
  )
  .get(
    "/current",
    describeRoute({
      description: "Get the current project",
      operationId: "project.current",
      responses: {
        200: {
          description: "Current project",
          content: {
            "application/json": {
              schema: resolver(Project.Info),
            },
          },
        },
      },
    }),
    // Получает информацию о текущем проекте
    async (c) => {
      return c.json(Instance.project)
    },
  )
