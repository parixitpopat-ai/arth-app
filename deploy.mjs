import { execSync } from "child_process";

const ALIASES = [
  "arth-app.vercel.app",
  "arth-app-parixit-popats-projects.vercel.app",
];

console.log("Deploying to Vercel...");

const out = execSync("npx vercel --prod --yes", {
  encoding: "utf8",
  stdio: ["inherit", "pipe", "inherit"],
});

console.log(out);

const deployUrls = out.match(/https:\/\/arth-[a-z0-9]+-parixit-popats-projects\.vercel\.app/g) || [];
const deployUrl = deployUrls.at(-1);

if (!deployUrl) {
  console.error("Could not find deployment URL in Vercel output.");
  process.exit(1);
}

for (const alias of ALIASES) {
  console.log(`\nAliasing ${deployUrl} -> ${alias}...`);
  execSync(`npx vercel alias set ${deployUrl} ${alias}`, { stdio: "inherit" });
}

console.log(`\nLive at https://${ALIASES[0]}`);
