import { camelCase, startCase } from 'lodash';
import { Container } from 'typedi';
import { DataSource } from 'typeorm';
import { URL } from 'url';
import tables from '../gen_db.json';
import { ConfigManager, DatabaseConfig } from '../src/libs/configure';

async function generateSchema() {
  console.log('=== Starting Database Schema Generation ===');

  // Entities to generate
  const Entities = tables.map((n) => startCase(camelCase(n)).replace(/ /g, ''));
  console.log('Entities to generate:', Entities);

  // Get config
  const cfg = ConfigManager.getConfig<DatabaseConfig>('database');
  
  console.log('Loaded config:', cfg);
  
  if (!cfg.mariaDBUrl) {
    throw new Error('mariaDBUrl is not defined in database config');
  }

  // Parse database URL
  const db = new URL(cfg.mariaDBUrl);
  const { hostname, pathname, port, username, password } = db;
  
  console.log('Database connection info:', {
    hostname,
    database: pathname.substring(1),
    port,
    username,
  });

  // Initialize DataSource for TypeORM 0.3
  const dataSource = new DataSource({
    type: 'mysql',
    host: hostname,
    port: parseInt(port),
    username: username,
    password: password,
    database: pathname.substring(1),
    synchronize: false,
    logging: false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connected successfully');
    
    // Register DataSource in TypeDI container
    Container.set('dataSource', dataSource);

    // Setup typeorm-model-generator arguments
    const argv = process.argv;
    const configs: string[] = [
      '-h', hostname,
      '-d', pathname.substring(1),
      '-p', port,
      '-u', username,
      '-x', password,
      '-e', 'mysql',
      '-o', `${cfg.output || './src'}/entities`,
      '--noConfig',
      '--cf', 'pascal',
      '--ce', 'pascal',
      '--cp', 'camel',
      '--relationIds',
      '--generateConstructor'
    ];

    configs.forEach((c) => argv.push(c));

    // Monkey-patch fs.writeFileSync to filter entities
    const fs = require('fs');
    const _writeFileSync = fs.writeFileSync;
    let generatedAmount = 0;
    let skippedAmount = 0;

    fs.writeFileSync = (...args: any) => {
      const p = args[0] as string;
      const file = p.substring(p.lastIndexOf('/') + 1, p.lastIndexOf('.'));
      const skip = !Entities.includes(file);
      
      if (skip) {
        skippedAmount++;
        console.log(`⏭️  Skipped: ${file}`);
      } else {
        _writeFileSync(...args);
        console.log(`✅ Generated: ${file}`);
        generatedAmount++;
      }
    };

    // Run typeorm-model-generator
    console.log('\n🚀 Running typeorm-model-generator...\n');
    require('typeorm-model-generator/dist/src');

    // 使用 setTimeout 等待 typeorm-model-generator 完成
    // typeorm-model-generator 是同步执行的，所以我们需要在它完成后执行清理
    setTimeout(async () => {
      console.log('\n=== Generation Summary ===');
      console.log(`✅ Generated Entities: ${generatedAmount}`);
      console.log(`⏭️  Skipped Entities: ${skippedAmount}`);
      
      // Close database connection
      if (dataSource.isInitialized) {
        await dataSource.destroy();
        console.log('✅ Database connection closed\n');
      }
      
      process.exit(0);
    }, 1000);

  } catch (error) {
    console.error('❌ Error during schema generation:', error);
    
    // Ensure connection is closed on error
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    
    process.exit(1);
  }
}

// Run the generator
generateSchema().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});