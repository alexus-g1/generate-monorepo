import inquirer from "inquirer";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

async function main() {
  const { packageManager, client, server, name } = await inquirer.prompt([
    {
      name: "packageManager",
      type: "list",
      message: "Выберите пакетный менеджер:",
      choices: ["npm", "yarn", "pnpm"],
    },
    {
      name: "client",
      type: "list",
      message: "Выберите фронтенд-фреймворк:",
      choices: ["React", "Vue", "Angular"],
    },
    {
      name: "server",
      type: "list",
      message: "Выберите бэкенд-фреймворк:",
      choices: ["Express", "Koa", "NestJS"],
    },
    {
      name: "name",
      type: "input",
      message: "Выберите название для проекта",
    },
  ]);

  const projectDir = name;
  fs.mkdirSync(projectDir);
  process.chdir(projectDir);
  if (packageManager == "pnpm") {
    execSync(`${packageManager} init`, { stdio: "inherit" });
    const pnpmWorkspacePath = path.join(process.cwd(), "pnpm-workspace.yaml");
    const pnpmYamlContent = 'packages:\n  - "apps/*"';
    fs.writeFileSync(pnpmWorkspacePath, pnpmYamlContent);
  } else {
    execSync(`${packageManager} init -y`, { stdio: "inherit" });
  }

  const pkgJsonPath = path.join(process.cwd(), "package.json");
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
  pkgJson.private = true;
  pkgJson.workspaces = ["apps/*"];
  pkgJson.dependencies = { concurrently: "^9.1.2" };
  pkgJson.scripts = {
    dev: `concurrently \"${packageManager} ${
      packageManager == "pnpm" ? "--dir" : "--cwd"
    } apps/client ${
      client == "Angular" ? "ng serve" : "run dev"
    }\"  \"${packageManager} ${
      packageManager == "pnpm" ? "--dir" : "--cwd"
    } apps/server run start:dev\"`,
  };
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));

  fs.mkdirSync("apps");

  await createClientApp(client, packageManager);
  await createServerApp(server, packageManager);

  console.log(
    "\n✅ Монорепозиторий успешно создан! Дальнейшие действия \ncd " +
      name +
      " - перейти в каталог проекта\n" +
      packageManager +
      " install - для установки зависимостей \n" +
      packageManager +
      " run dev для старта."
  );
}

async function createClientApp(client, packageManager) {
  const clientDir = path.join("apps", "client");
  switch (client) {
    case "React":
      execSync(`npm create vite@latest client -- --template react`, {
        stdio: "inherit",
      });
      moveAppToAppsFolder("client");
      addReactFetchExample(path.join("apps", "client"));
      break;
    case "Vue":
      execSync(`npm create vue@latest client`, { stdio: "inherit" });
      moveAppToAppsFolder("client");
      addVueFetchExample(path.join("apps", "client"));
      break;
    case "Angular":
      execSync(
        `npx -p @angular/cli ng new client --directory=client --skip-install`,
        { stdio: "inherit" }
      );
      moveAppToAppsFolder("client");
      addAngularFetchExample(path.join("apps", "client"));
      break;
  }
}

async function createServerApp(server, packageManager) {
  const serverDir = path.join("apps", "server");
  switch (server) {
    case "Express":
      fs.mkdirSync(serverDir);
      fs.writeFileSync(
        path.join(serverDir, "index.js"),
        `const express = require('express');\nconst cors = require('cors');\nconst app = express();\napp.use(cors());\napp.get('/api/message', (req, res) => res.json({ message: 'Hello from Express!' }));\napp.listen(3000, () => console.log('Server running on http://localhost:3000'));`
      );
      fs.writeFileSync(
        path.join(serverDir, "package.json"),
        JSON.stringify(
          {
            version: "0.0.0",
            dependencies: {
              express: "^4.21.2",
              cors: "^2.8.5",
            },
            name: "server",
            scripts: { "start:dev": "node index.js" },
          },
          null,
          2
        )
      );
      break;
    case "Koa":
      fs.mkdirSync(serverDir);
      fs.writeFileSync(
        path.join(serverDir, "index.js"),
        `const Koa = require('koa');\nconst cors = require('@koa/cors');\nconst app = new Koa();\napp.use(cors());\napp.use(ctx => {\n  if (ctx.path === '/api/message') {\n    ctx.body = { message: 'Hello from Koa!' };\n  }\n});\napp.listen(3000, () => console.log('Server running on http://localhost:3000'));`
      );
      fs.writeFileSync(
        path.join(serverDir, "package.json"),
        JSON.stringify(
          {
            version: "0.0.0",
            dependencies: {
              koa: "^3.0.0",
              "@koa/cors": "5.0.0",
            },
            name: "server",
            scripts: { "start:dev": "node index.js" },
          },
          null,
          2
        )
      );
      break;
    case "NestJS":
      execSync(`npx @nestjs/cli new server --skip-install --directory=server`, {
        stdio: "inherit",
      });
      moveAppToAppsFolder("server");
      enableCorsInNest(path.join("apps", "server"));
      addNestMessageEndpoint(path.join("apps", "server"));
      const nestPkg = path.join("apps", "server", "package.json");
      const json = JSON.parse(fs.readFileSync(nestPkg, "utf-8"));
      json.scripts["start:dev"] = "nest start --watch";
      fs.writeFileSync(nestPkg, JSON.stringify(json, null, 2));
      break;
  }
}

function moveAppToAppsFolder(name) {
  const from = path.join(".", name);
  const to = path.join("apps", name);
  if (fs.existsSync(from)) {
    fs.renameSync(from, to);
  }
}

function addReactFetchExample(clientPath) {
  const appPath = path.join(clientPath, "src", "App.jsx");
  if (!fs.existsSync(appPath)) return;
  const content = `import { useEffect, useState } from 'react';\nimport './App.css';\n\nfunction App() {\n  const [message, setMessage] = useState('');\n\n  useEffect(() => {\n    fetch('http://localhost:3000/api/message')\n      .then(res => res.json())\n      .then(data => setMessage(data.message));\n  }, []);\n\n  return (\n    <div className=\"App\">\n      <h1>{message}</h1>\n    </div>\n  );\n}\n\nexport default App;`;

  fs.writeFileSync(appPath, content);
}

function addVueFetchExample(clientPath) {
  const appPath = path.join(clientPath, "src", "App.vue");
  if (!fs.existsSync(appPath)) return;
  const content = `<template>\n  <div>\n    <h1>{{ message }}</h1>\n  </div>\n</template>\n\n<script setup>\nimport { ref, onMounted } from 'vue';\nconst message = ref('');\n\nonMounted(async () => {\n  const res = await fetch('http://localhost:3000/api/message');\n  const data = await res.json();\n  message.value = data.message;\n});\n</script>`;

  fs.writeFileSync(appPath, content);
}

function addAngularFetchExample(clientPath) {
  const appComponentPath = path.join(
    clientPath,
    "src",
    "app",
    "app.component.ts"
  );
  const appTemplatePath = path.join(
    clientPath,
    "src",
    "app",
    "app.component.html"
  );
  const appConfigPath = path.join(clientPath, "src", "app", "app.config.ts");

  if (fs.existsSync(appComponentPath)) {
    const tsContent = `import { Component, OnInit } from '@angular/core';\nimport { HttpClient } from '@angular/common/http';\n\n@Component({\n  selector: 'app-root',\n  templateUrl: './app.component.html',\n})\nexport class AppComponent implements OnInit {\n  message = '';\n\n  constructor(private http: HttpClient) {}\n\n  ngOnInit(): void {\n    this.http.get<{ message: string }>('http://localhost:3000/api/message')\n      .subscribe(data => this.message = data.message);\n  }\n}`;
    fs.writeFileSync(appComponentPath, tsContent);
  }

  if (fs.existsSync(appTemplatePath)) {
    const htmlContent = `<h1>{{ message }}</h1>`;
    fs.writeFileSync(appTemplatePath, htmlContent);
  }

  if (fs.existsSync(appConfigPath)) {
    let configContent = fs.readFileSync(appConfigPath, "utf-8");
    configContent = `import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
  ],
};
`;
    fs.writeFileSync(appConfigPath, configContent);
  }
}

function enableCorsInNest(serverPath) {
  const mainPath = path.join(serverPath, "src", "main.ts");
  if (!fs.existsSync(mainPath)) return;

  let content = fs.readFileSync(mainPath, "utf-8");

  if (!content.includes("app.enableCors()")) {
    content = content.replace(
      /(const app = await NestFactory\.create\([^\)]+\);)/,
      `$1\n  app.enableCors();`
    );
    fs.writeFileSync(mainPath, content);
  }
}

function addNestMessageEndpoint(serverPath) {
  const controllerPath = path.join(serverPath, "src", "app.controller.ts");
  if (!fs.existsSync(controllerPath)) return;

  let content = fs.readFileSync(controllerPath, "utf-8");

  content = `import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('api/message')  
  getMessage() {    
    return { message: 'Hello from NestJS!' }
  }
}`;

  fs.writeFileSync(controllerPath, content);
}

main();
