#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const cliPath = join(process.cwd(), 'dist', 'cli.js')

try {
  let content = readFileSync(cliPath, 'utf-8')

  // 如果文件开头没有 shebang，添加一个
  if (!content.startsWith('#!/usr/bin/env node')) {
    content = '#!/usr/bin/env node\n' + content
    writeFileSync(cliPath, content)
    console.log('✅ CLI shebang added successfully')
  } else {
    console.log('✅ CLI shebang already exists')
  }
} catch (error) {
  console.error('❌ Failed to fix CLI shebang:', error.message)
  process.exit(1)
}