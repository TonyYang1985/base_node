import { camelCase, startCase } from 'lodash';
import { Container } from 'typedi';
import { DataSource } from 'typeorm';
import { URL } from 'url';
import tables from '../gen_db.json';
import { ConfigManager, DatabaseConfig } from '../src/libs/configure';

async function generateRepositories() {
  console.log('=== Starting Repository Generation ===');

  // Entities to generate repositories for
  const Entities = tables.map((n) => startCase(camelCase(n)).replace(/ /g, ''));
  console.log('Repositories to generate:', Entities);

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
      '-o', `${cfg.output || './src'}/repositories`,
      '--noConfig',
      '--cf', 'pascal',
      '--ce', 'pascal',
      '--cp', 'camel',
      '--relationIds',
      '--generateConstructor'
    ];

    configs.forEach((c) => argv.push(c));

    // Monkey-patch path.resolve to use custom template
    const path = require('path');
    const _pathResolver = path.resolve;
    
    path.resolve = (...args: any) => {
      let isTarget = false;
      
      args.forEach((arg: string) => {
        if (arg.indexOf('entity.mst') > -1) {
          isTarget = true;
        }
      });

      return isTarget ? _pathResolver(__dirname, 'repository.mst') : _pathResolver(...args);
    };

    // Monkey-patch fs.writeFileSync
    const fs = require('fs');
    const _writeFileSync = fs.writeFileSync;
    let generatedAmount = 0;
    let skippedAmount = 0;

    fs.writeFileSync = (...args: any) => {
      const originalPath = args[0] as string;
      
      // Change filename: Entity.ts -> EntityRepo.ts
      args[0] = originalPath.substring(0, originalPath.length - 3) + 'Repo.ts';
      
      // Check if file already exists
      if (fs.existsSync(args[0])) {
        console.log(`⏭️  Skipped (exists): ${args[0]}`);
        skippedAmount++;
        return;
      }

      // Extract entity name from path
      const file = originalPath.substring(
        originalPath.lastIndexOf('/') + 1, 
        originalPath.lastIndexOf('.')
      );
      
      // Check if this entity should be generated
      const skip = !Entities.includes(file);
      
      if (skip) {
        console.log(`⏭️  Skipped (not in list): ${file}`);
        skippedAmount++;
      } else {
        _writeFileSync(...args);
        console.log(`✅ Generated: ${args[0]}`);
        generatedAmount++;
      }
    };

    // Run typeorm-model-generator
    console.log('\n🚀 Running typeorm-model-generator...\n');
    require('typeorm-model-generator/dist/src');

    // 使用 setTimeout 等待 typeorm-model-generator 完成
    setTimeout(async () => {
      console.log('\n=== Generation Summary ===');
      console.log(`✅ Generated Repositories: ${generatedAmount}`);
      console.log(`⏭️  Skipped Repositories: ${skippedAmount}`);
      
      // Close database connection
      if (dataSource.isInitialized) {
        await dataSource.destroy();
        console.log('✅ Database connection closed\n');
      }
      
      process.exit(0);
    }, 1000);

  } catch (error) {
    console.error('❌ Error during repository generation:', error);
    
    // Ensure connection is closed on error
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    
    process.exit(1);
  }
}

// Run the generator
generateRepositories().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});