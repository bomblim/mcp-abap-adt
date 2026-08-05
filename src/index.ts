#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import path from 'path';
import dotenv from 'dotenv';

// Import handler functions
import { handleGetProgram } from './handlers/handleGetProgram';
import { handleGetClass } from './handlers/handleGetClass';
import { handleGetFunctionGroup } from './handlers/handleGetFunctionGroup';
import { handleGetFunction } from './handlers/handleGetFunction';
import { handleGetTable } from './handlers/handleGetTable';
import { handleGetStructure } from './handlers/handleGetStructure';
import { handleGetTableContents } from './handlers/handleGetTableContents';
import { handleGetPackage } from './handlers/handleGetPackage';
import { handleGetInclude } from './handlers/handleGetInclude';
import { handleGetTypeInfo } from './handlers/handleGetTypeInfo';
import { handleGetInterface } from './handlers/handleGetInterface';
import { handleGetTransaction } from './handlers/handleGetTransaction';
import { handleSearchObject } from './handlers/handleSearchObject';
import { handleGetCDSView } from './handlers/handleGetCDSView';
import { handleGetBehaviorDefinition } from './handlers/handleGetBehaviorDefinition';
import { handleGetServiceDefinition } from './handlers/handleGetServiceDefinition';
import { handleLockObject } from './handlers/handleLockObject';
import { handleUnlockObject } from './handlers/handleUnlockObject';
import { handleActivateObject } from './handlers/handleActivateObject';
import { handleSaveObjectSource } from './handlers/handleSaveObjectSource';
import { handleCreateObject } from './handlers/handleCreateObject';
import { handleCheckObject } from './handlers/handleCheckObject';

// Import shared utility functions and types
import { getBaseUrl, getAuthHeaders, createAxiosInstance, makeAdtRequest, return_error, return_response } from './lib/utils';
import { objectLocatorSchemaProperties } from './lib/objectTypes';
import { createObjectSchemaProperties } from './lib/objectCreate';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Interface for SAP configuration
export interface SapConfig {
  url: string;
  username: string;
  password: string;
  client: string;
}

/**
 * Retrieves SAP configuration from environment variables.
 *
 * @returns {SapConfig} The SAP configuration object.
 * @throws {Error} If any required environment variable is missing.
 */
export function getConfig(): SapConfig {
  const url = process.env.SAP_URL;
  const username = process.env.SAP_USERNAME;
  const password = process.env.SAP_PASSWORD;
  const client = process.env.SAP_CLIENT;

  // Check if all required environment variables are set
  if (!url || !username || !password || !client) {
    throw new Error(`Missing required environment variables. Required variables:
- SAP_URL
- SAP_USERNAME
- SAP_PASSWORD
- SAP_CLIENT`);
  }

  return { url, username, password, client };
}

/**
 * Server class for interacting with ABAP systems via ADT.
 */
export class mcp_abap_adt_server {
  private server: Server;  // Instance of the MCP server
  private sapConfig: SapConfig; // SAP configuration

  /**
   * Constructor for the mcp_abap_adt_server class.
   */
  constructor() {
    this.sapConfig = getConfig(); // Load SAP configuration
    this.server = new Server(  // Initialize the MCP server
      {
        name: 'mcp-abap-adt', // Server name
        version: '0.1.0',       // Server version
      },
      {
        capabilities: {
          tools: {}, // Initially, no tools are registered
        },
      }
    );

    this.setupHandlers(); // Setup request handlers
  }

  /**
   * Sets up request handlers for listing and calling tools.
   * @private
   */
  private setupHandlers() {
    // Setup tool handlers

    // Handler for ListToolsRequest
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [ // Define available tools
          {
            name: 'GetProgram',
            description: 'Retrieve ABAP program source code',
            inputSchema: {
              type: 'object',
              properties: {
                program_name: {
                  type: 'string',
                  description: 'Name of the ABAP program'
                }
              },
              required: ['program_name']
            }
          },
          {
            name: 'GetClass',
            description: 'Retrieve ABAP class source code',
            inputSchema: {
              type: 'object',
              properties: {
                class_name: {
                  type: 'string',
                  description: 'Name of the ABAP class'
                }
              },
              required: ['class_name']
            }
          },
          {
            name: 'GetFunctionGroup',
            description: 'Retrieve ABAP Function Group source code',
            inputSchema: {
              type: 'object',
              properties: {
                function_group: {
                  type: 'string',
                  description: 'Name of the function module'
                }
              },
              required: ['function_group']
            }
          },
          {
            name: 'GetFunction',
            description: 'Retrieve ABAP Function Module source code',
            inputSchema: {
              type: 'object',
              properties: {
                function_name: {
                  type: 'string',
                  description: 'Name of the function module'
                },
                function_group: {
                  type: 'string',
                  description: 'Name of the function group'
                }
              },
              required: ['function_name', 'function_group']
            }
          },
          {
            name: 'GetStructure',
            description: 'Retrieve ABAP Structure',
            inputSchema: {
              type: 'object',
              properties: {
                structure_name: {
                  type: 'string',
                  description: 'Name of the ABAP Structure'
                }
              },
              required: ['structure_name']
            }
          },
          {
            name: 'GetTable',
            description: 'Retrieve ABAP table structure',
            inputSchema: {
              type: 'object',
              properties: {
                table_name: {
                  type: 'string',
                  description: 'Name of the ABAP table'
                }
              },
              required: ['table_name']
            }
          },
          {
            name: 'GetTableContents',
            description: 'Retrieve contents of an ABAP table',
            inputSchema: {
              type: 'object',
              properties: {
                table_name: {
                  type: 'string',
                  description: 'Name of the ABAP table'
                },
                max_rows: {
                  type: 'number',
                  description: 'Maximum number of rows to retrieve',
                  default: 100
                }
              },
              required: ['table_name']
            }
          },
          {
            name: 'GetPackage',
            description: 'Retrieve ABAP package details',
            inputSchema: {
              type: 'object',
              properties: {
                package_name: {
                  type: 'string',
                  description: 'Name of the ABAP package'
                }
              },
              required: ['package_name']
            }
          },
          {
            name: 'GetTypeInfo',
            description: 'Retrieve ABAP type information',
            inputSchema: {
              type: 'object',
              properties: {
                type_name: {
                  type: 'string',
                  description: 'Name of the ABAP type'
                }
              },
              required: ['type_name']
            }
          },
          {
            name: 'GetInclude',
            description: 'Retrieve ABAP Include Source Code',
            inputSchema: {
              type: 'object',
              properties: {
                include_name: {
                  type: 'string',
                  description: 'Name of the ABAP Include'
                }
              },
              required: ['include_name']
            }
          },
          {
            name: 'SearchObject',
            description: 'Search for ABAP objects using quick search',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query string (use * wildcard for partial match)'
                },
                maxResults: {
                  type: 'number',
                  description: 'Maximum number of results to return',
                  default: 100
                }
              },
              required: ['query']
            }
          },
          {
            name: 'GetTransaction',
            description: 'Retrieve ABAP transaction details',
            inputSchema: {
              type: 'object',
              properties: {
                transaction_name: {
                  type: 'string',
                  description: 'Name of the ABAP transaction'
                }
              },
              required: ['transaction_name']
            }
          },
          {
            name: 'GetCDSView',
            description: 'Retrieve CDS view (DDL source) source code',
            inputSchema: {
              type: 'object',
              properties: {
                cds_view_name: {
                  type: 'string',
                  description: 'Name of the CDS view (DDL source name, e.g. I_CURRENCY)'
                }
              },
              required: ['cds_view_name']
            }
          },
          {
            name: 'GetInterface',
            description: 'Retrieve ABAP interface source code',
            inputSchema: {
              type: 'object',
              properties: {
                interface_name: {
                  type: 'string',
                  description: 'Name of the ABAP interface'
                }
              },
              required: ['interface_name']
            }
          },
          {
            name: 'GetBehaviorDefinition',
            description: 'Retrieve RAP Behavior Definition (BDEF) source code (requires ~NW 7.54 / S/4HANA)',
            inputSchema: {
              type: 'object',
              properties: {
                behavior_definition_name: {
                  type: 'string',
                  description: 'Name of the RAP Behavior Definition (e.g. I_MY_ENTITY)'
                }
              },
              required: ['behavior_definition_name']
            }
          },
          {
            name: 'GetServiceDefinition',
            description: 'Retrieve RAP Service Definition (SRVD) source code (requires ~NW 7.54 / S/4HANA)',
            inputSchema: {
              type: 'object',
              properties: {
                service_definition_name: {
                  type: 'string',
                  description: 'Name of the RAP Service Definition (e.g. Z_MY_SERVICE)'
                }
              },
              required: ['service_definition_name']
            }
          },
          {
            name: 'CreateObject',
            description: 'Step 1 of 6 (new objects only) in the ABAP edit workflow: CreateObject -> LockObject -> SaveObjectSource -> CheckObject (optional) -> ActivateObject -> UnlockObject. Creates a new ABAP object (program, class, interface, function group, or include), without source. Skip this step when editing an object that already exists. Note: this cannot create a Dynpro/screen directly (no ADT endpoint for that) — for "create a screen" requests, either write a selection-screen report (object_type=program is enough), or for a real Screen Painter dynpro, create a generator program (e.g. using RPY_DYNPRO_INSERT) and tell the user to run it once via SE38; see README section 9.1.',
            inputSchema: {
              type: 'object',
              properties: createObjectSchemaProperties,
              required: ['object_type', 'object_name', 'package_name']
            }
          },
          {
            name: 'LockObject',
            description: 'Step 2 of 6 in the ABAP edit workflow: CreateObject (skip if editing an existing object) -> LockObject -> SaveObjectSource -> CheckObject (optional) -> ActivateObject -> UnlockObject. Locks an ABAP object for editing and returns a lockHandle, which must be passed to SaveObjectSource and UnlockObject.',
            inputSchema: {
              type: 'object',
              properties: objectLocatorSchemaProperties,
              required: ['object_type', 'object_name']
            }
          },
          {
            name: 'UnlockObject',
            description: 'Step 6 of 6 (final step) in the ABAP edit workflow: CreateObject -> LockObject -> SaveObjectSource -> CheckObject (optional) -> ActivateObject -> UnlockObject. Releases a lock previously acquired with LockObject. Call this last, after ActivateObject, to avoid a race window where the object is unlocked but not yet activated.',
            inputSchema: {
              type: 'object',
              properties: {
                ...objectLocatorSchemaProperties,
                lock_handle: {
                  type: 'string',
                  description: 'Lock handle returned by LockObject'
                }
              },
              required: ['object_type', 'object_name', 'lock_handle']
            }
          },
          {
            name: 'SaveObjectSource',
            description: 'Step 3 of 6 in the ABAP edit workflow: CreateObject -> LockObject -> SaveObjectSource -> CheckObject (optional) -> ActivateObject -> UnlockObject. Writes new source code to an object locked with LockObject; requires the lockHandle it returned. Does not activate the object.',
            inputSchema: {
              type: 'object',
              properties: {
                ...objectLocatorSchemaProperties,
                lock_handle: {
                  type: 'string',
                  description: 'Lock handle returned by LockObject'
                },
                source_code: {
                  type: 'string',
                  description: 'Full new source code of the object'
                },
                transport_request: {
                  type: 'string',
                  description: 'Transport request number, required if the object belongs to a non-local package'
                }
              },
              required: ['object_type', 'object_name', 'lock_handle', 'source_code']
            }
          },
          {
            name: 'CheckObject',
            description: 'Optional step 4 of 6 in the ABAP edit workflow, between SaveObjectSource and ActivateObject: CreateObject -> LockObject -> SaveObjectSource -> CheckObject -> ActivateObject -> UnlockObject. Runs an ADT syntax check against an object\'s source (the same check Eclipse ADT runs on save) without activating it, so errors can be caught before spending an activation attempt.',
            inputSchema: {
              type: 'object',
              properties: {
                ...objectLocatorSchemaProperties,
                version: {
                  type: 'string',
                  enum: ['active', 'inactive'],
                  description: 'Which version of the source to check. Use "inactive" to check a version just written by SaveObjectSource but not yet activated. Defaults to "inactive".'
                }
              },
              required: ['object_type', 'object_name']
            }
          },
          {
            name: 'ActivateObject',
            description: 'Step 5 of 6 in the ABAP edit workflow: CreateObject -> LockObject -> SaveObjectSource -> CheckObject (optional) -> ActivateObject -> UnlockObject. Activates an inactive ABAP object after its source has been saved. Call this before UnlockObject, while the object is still locked, to avoid another user locking and changing it in between.',
            inputSchema: {
              type: 'object',
              properties: objectLocatorSchemaProperties,
              required: ['object_type', 'object_name']
            }
          }
        ]
      };
    });

    // Handler for CallToolRequest
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'GetProgram':
          return await handleGetProgram(request.params.arguments);
        case 'GetClass':
          return await handleGetClass(request.params.arguments);
        case 'GetFunction':
          return await handleGetFunction(request.params.arguments);
        case 'GetFunctionGroup':
          return await handleGetFunctionGroup(request.params.arguments);
        case 'GetStructure':
          return await handleGetStructure(request.params.arguments);
        case 'GetTable':
          return await handleGetTable(request.params.arguments);
        case 'GetTableContents':
          return await handleGetTableContents(request.params.arguments);
        case 'GetPackage':
          return await handleGetPackage(request.params.arguments);
        case 'GetTypeInfo':
          return await handleGetTypeInfo(request.params.arguments);
        case 'GetInclude':
          return await handleGetInclude(request.params.arguments);
        case 'SearchObject':
          return await handleSearchObject(request.params.arguments);
        case 'GetInterface':
          return await handleGetInterface(request.params.arguments);
        case 'GetTransaction':
          return await handleGetTransaction(request.params.arguments);
        case 'GetCDSView':
          return await handleGetCDSView(request.params.arguments);
        case 'GetBehaviorDefinition':
          return await handleGetBehaviorDefinition(request.params.arguments);
        case 'GetServiceDefinition':
          return await handleGetServiceDefinition(request.params.arguments);
        case 'CreateObject':
          return await handleCreateObject(request.params.arguments);
        case 'LockObject':
          return await handleLockObject(request.params.arguments);
        case 'UnlockObject':
          return await handleUnlockObject(request.params.arguments);
        case 'SaveObjectSource':
          return await handleSaveObjectSource(request.params.arguments);
        case 'CheckObject':
          return await handleCheckObject(request.params.arguments);
        case 'ActivateObject':
          return await handleActivateObject(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });

    // Handle server shutdown on SIGINT (Ctrl+C)
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  /**
   * Starts the MCP server and connects it to the transport.
   */
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

// Create and run the server
const server = new mcp_abap_adt_server();
server.run().catch((error) => {
  process.exit(1);
});
