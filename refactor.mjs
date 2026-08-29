import fs from 'fs';
import path from 'path';

const dir = 'd:/WebHookCatch.com/src/pages';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.astro') && f !== 'index.astro' && f !== '[id].astro');

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace imports
  content = content.replace(/import Layout from '\.\.\/layouts\/Layout\.astro';\s*/g, "import SEOLayout from '../layouts/SEOLayout.astro';\n");
  content = content.replace(/import Navbar from '\.\.\/components\/Navbar\.astro';\s*/g, "");
  content = content.replace(/import Footer from '\.\.\/components\/Footer\.astro';\s*/g, "");
  
  // Replace opening Layout
  content = content.replace(/<Layout title=\{title\} description=\{description\}>\s*<script type="application\/ld\+json" set:html=\{JSON\.stringify\(jsonLd\)\} \/>\s*<Navbar \/>/g, "<SEOLayout title={title} description={description} jsonLd={jsonLd}>");
  
  // Replace closing Layout
  content = content.replace(/<Footer \/>\s*<\/Layout>/g, "</SEOLayout>");

  fs.writeFileSync(filePath, content);
  console.log(`Refactored ${file}`);
}
