import * as dotenv from "dotenv";
dotenv.config();

import * as schema from '../../drizzle/schema'; // Assuming you have a database connection

import { Client, Pool } from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
import { ConfigIndex } from "../config/index";
const client = new Client(ConfigIndex.database);
client.connect();
export const db = drizzle(client, {schema:schema});
