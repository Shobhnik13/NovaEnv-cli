#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');
const readline = require('readline');

const configPath = path.join(os.homedir(), 'novaenv-cli-config.json');
const baseURLAuth = 'http://localhost:5005/api/v1/cli/auth';
const baseURLProject = 'http://localhost:5005/api/v1/cli/project';
const baseURLEnviornment = 'http://localhost:5005/api/v1/cli/enviornment';
const baseURLVariable = 'http://localhost:5005/api/v1/cli/variable';

// Login command
async function login() {
    console.log('\n🔐 Login to NovaEnv CLI');
    console.log('═══════════════════════\n');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const apiKey = await new Promise(resolve => {
        rl.question('Enter your API key: ', answer => {
            rl.close();
            resolve(answer.trim());
        });
    });

    if (!apiKey) {
        console.error('❌ API key is required');
        process.exit(1);
    }

    console.log('🔄 Verifying API key...');

    const url = new URL(`${baseURLAuth}/login`);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    const port = url.port || (isHttps ? 443 : 80);

    const options = {
        hostname: url.hostname,
        port: port,
        path: url.pathname,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }
    };

    const req = httpModule.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            if (res.statusCode === 200) {
                const user = JSON.parse(data);
                fs.writeFileSync(configPath, JSON.stringify({ apiKey, user: user.data }, null, 2));
                console.log(`✅ Successfully logged in as ${user.data.name || user.data.email}`);
            } else {
                console.error('❌ Login failed: Invalid API key');
                process.exit(1);
            }
        });
    });

    req.on('error', (error) => {
        console.error('❌ Login failed:', error.message);
        process.exit(1);
    });

    req.end();
}

// List projects
async function projects() {
    let config = {};
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
        console.error('❌ Please login first using: novaenv-cli login');
        process.exit(1);
    }

    console.log('\n📂 Your Projects');
    console.log('═══════════════\n');

    const url = new URL(`${baseURLProject}/projects`);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    const port = url.port || (isHttps ? 443 : 80);

    const options = {
        hostname: url.hostname,
        port: port,
        path: url.pathname,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
        }
    };

    const req = httpModule.request(options, async (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', async () => {
            if (res.statusCode === 200) {
                const response = JSON.parse(data);
                const projectsList = response.data;

                if (projectsList.length === 0) {
                    console.log('No projects found.');
                    return;
                }

                projectsList.forEach((project, index) => {
                    console.log(`${index + 1}. ${project.name}`);
                    console.log(`   ID: ${project.projectId}`);
                    console.log(`   Created: ${new Date(project.createdAt).toLocaleDateString()}`);
                    console.log('');
                });

                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });

                const selection = await new Promise(resolve => {
                    rl.question('Select project (enter number): ', answer => {
                        rl.close();
                        resolve(answer.trim());
                    });
                });

                const projectIndex = parseInt(selection) - 1;
                if (projectIndex >= 0 && projectIndex < projectsList.length) {
                    getEnvironments(projectsList[projectIndex]._id, projectsList[projectIndex].name, config.apiKey, projectsList[projectIndex].projectId);
                } else {
                    console.error('❌ Invalid selection');
                }
            } else {
                console.error("❌", JSON.parse(data)?.error);
            }
        });
    });

    req.on('error', (error) => {
        console.error('❌ Error:', error.message);
    });

    req.end();
}

// Get environments
function getEnvironments(projectId, projectName, apiKey, customProjectId) {
    console.log(`\n🌍 Environments for "${projectName}"`);
    console.log('═══════════════════════════════\n');
    console.log(customProjectId);

    const url = new URL(`${baseURLEnviornment}/project/${customProjectId}/enviornments`);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    const port = url.port || (isHttps ? 443 : 80);

    const options = {
        hostname: url.hostname,
        port: port,
        path: url.pathname,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }
    };

    const req = httpModule.request(options, async (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', async () => {
            if (res.statusCode === 200) {
                const response = JSON.parse(data);
                const environments = response.data;

                if (environments.length === 0) {
                    console.log('No environments found.');
                    return;
                }

                environments.forEach((env, index) => {
                    console.log(`${index + 1}. ${env.name}`);
                    console.log('');
                });

                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });

                const selection = await new Promise(resolve => {
                    rl.question('Select environment (enter number): ', answer => {
                        rl.close();
                        resolve(answer.trim());
                    });
                });

                const envIndex = parseInt(selection) - 1;
                if (envIndex >= 0 && envIndex < environments.length) {
                    getVariables(projectId, environments[envIndex].enviornmentId, environments[envIndex].name, apiKey, customProjectId);
                } else {
                    console.error('❌ Invalid selection');
                }
            } else {
                console.error('❌ Error fetching environments');
                console.error('Response:', data);
            }
        });
    });

    req.on('error', (error) => {
        console.error('❌ Error:', error.message);
    });

    req.end();
}

// Get variables and create .env file
function getVariables(projectId, enviornmentId, environmentName, apiKey, customProjectId) {
    console.log(`\n📝 Extracting and decrypting variables from "${environmentName}"`);
    console.log('═══════════════════════════════════════════\n');

    const url = new URL(`${baseURLVariable}/project/${customProjectId}/enviornments/${enviornmentId}/variables`);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    const port = url.port || (isHttps ? 443 : 80);

    const options = {
        hostname: url.hostname,
        port: port,
        path: url.pathname,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }
    };

    const req = httpModule.request(options, async (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', async () => {
            if (res.statusCode === 200) {
                const response = JSON.parse(data);
                const variables = response.data;

                if (variables.length === 0) {
                    console.log('No variables found.');
                    return;
                }

                let envContent = ``

                variables.forEach(variable => {
                    envContent += `${variable}\n`;
                });


                const envFilePath = path.join(process.cwd(), '.env');

                if (fs.existsSync(envFilePath)) {
                    const rl = readline.createInterface({
                        input: process.stdin,
                        output: process.stdout
                    });

                    const overwrite = await new Promise(resolve => {
                        rl.question('.env file exists. Overwrite? (y/N): ', answer => {
                            rl.close();
                            resolve(answer.trim().toLowerCase());
                        });
                    });

                    if (overwrite !== 'y') {
                        console.log('❌ Operation cancelled');
                        return;
                    }
                }

                fs.writeFileSync(envFilePath, envContent);

                console.log(`✅ Wohoo, Successfully extracted ${variables.length} variables to .env`);
                console.log(`📁 File saved at: ${envFilePath}`);
            }
        });
    });

    req.on('error', (error) => {
        console.error('❌ Error:', error.message);
    });

    req.end();
}

// Logout
function logout() {
    try {
        if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
            console.log('✅ Successfully logged out');
        } else {
            console.log('ℹ️  Already logged out');
        }
    } catch (error) {
        console.error('❌ Error during logout:', error.message);
    }
}

// Help
function showHelp() {
    console.log(`
🚀 EnvVar CLI - Environment Variable Manager
════════════════════════════════════════════

Commands:
  login         Login with your API key
  projects      List and select projects  
  logout        Logout and clear credentials
  help          Show this help message

Usage:
  novaenv-cli login
  novaenv-cli projects
  novaenv-cli logout
  `);
}

// Main execution
const command = process.argv[2];
// this brings out the novaenv-cli(0) (1) login(2)

console.log('🔧 NovaEnv CLI v1.0.0\n');

switch (command) {
    case 'login':
        login();
        break;
    case 'projects':
        projects();
        break;
    case 'logout':
        logout();
        break;
    case 'help':
    case '--help':
    case '-h':
        showHelp();
        break;
    default:
        if (!command) {
            showHelp();
        } else {
            console.error(`❌ Unknown command: ${command}`);
            console.log('Run "novaenv-cli help" for available commands');
        }
}