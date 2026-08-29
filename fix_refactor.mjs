import fs from 'fs';
import path from 'path';

const dir = 'd:/WebHookCatch.com/src/pages';

// Revert 404 and 500
for (const file of ['404.astro', '500.astro']) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace("import SEOLayout from '../layouts/SEOLayout.astro';", "import Layout from '../layouts/Layout.astro';");
  fs.writeFileSync(filePath, content);
}

// Fix pages with Navbar/Footer but no ld+json
for (const file of ['about-us.astro', 'contact.astro', 'privacy-policy.astro', 'terms-and-conditions.astro']) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // They already have `import SEOLayout from '../layouts/SEOLayout.astro';` from previous script
  // But they still have `<Layout...>` and `</Layout>` and `<Navbar />` and `<Footer />` inside the template
  
  content = content.replace(/<Layout ([^>]*)>/, "<SEOLayout $1>");
  content = content.replace(/<\/Layout>/, "</SEOLayout>");
  content = content.replace(/<Navbar \/>\s*/, "");
  content = content.replace(/<Footer \/>\s*/, "");

  fs.writeFileSync(filePath, content);
}

console.log("Fixed files.");
