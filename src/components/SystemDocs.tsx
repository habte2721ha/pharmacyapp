import React, { useState } from 'react';
import { 
  Database, Server, Terminal, FileCode, CheckCircle, 
  Settings, Key, Layers, BookOpen, AlertTriangle 
} from 'lucide-react';

export default function SystemDocs() {
  const [activeTab, setActiveTab] = useState<'schema' | 'api' | 'install' | 'backup'>('schema');

  return (
    <div id="system-docs" className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-100 pb-5 mb-6">
        <div>
          <h2 className="text-xl font-sans font-semibold text-gray-900 tracking-tight flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-emerald-600" />
            Technical Documentation &amp; Deliverables
          </h2>
          <p className="text-sm text-gray-500 font-sans mt-1">
            Complete production manual, API references, schema mappings, and deployment guides.
          </p>
        </div>
        
        {/* Tab Controls */}
        <div className="flex flex-wrap gap-2 mt-4 md:mt-0 bg-gray-55 p-1 rounded-lg border border-gray-200">
          <button
            onClick={() => setActiveTab('schema')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === 'schema' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            Database Schema
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === 'api' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            REST API Spec
          </button>
          <button
            onClick={() => setActiveTab('install')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === 'install' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Server className="h-3.5 w-3.5" />
            Deployment &amp; Dev Ops
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === 'backup' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileCode className="h-3.5 w-3.5" />
            Backup &amp; Migration
          </button>
        </div>
      </div>

      {activeTab === 'schema' && (
        <div className="space-y-6">
          <div className="bg-emerald-50 text-emerald-800 p-4 rounded-lg flex gap-3 text-xs leading-relaxed">
            <Layers className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block mb-1">Entity-Relationship Topology</span>
              This schema supports multi-branch data isolation. The primary tables represent global indexes (such as Medicines, Customers, and Suppliers), while branch transactions (such as Sales, StockItems, and Expenses) are explicitly partitioned by <code className="bg-emerald-100 px-1 rounded">branchId</code>.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-gray-150 rounded-lg p-4">
              <h3 className="text-sm font-sans font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                Table: <code className="text-emerald-700">branches</code>
              </h3>
              <p className="text-xs text-gray-500 mb-3">Defines pharmaceutical brick-and-mortar nodes.</p>
              <div className="bg-gray-50 p-3 rounded font-mono text-xs text-gray-700 leading-normal">
                - <b>id</b>: VARCHAR(10) PRIMARY KEY [e.g., "b1"]<br />
                - <b>name</b>: VARCHAR(100) NOT NULL<br />
                - <b>code</b>: VARCHAR(10) UNIQUE NOT NULL [e.g., "SP-MAIN"]<br />
                - <b>address</b>: TEXT NOT NULL<br />
                - <b>phone</b>: VARCHAR(20) NOT NULL
              </div>
            </div>

            <div className="border border-gray-150 rounded-lg p-4">
              <h3 className="text-sm font-sans font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                Table: <code className="text-emerald-700">medicines</code>
              </h3>
              <p className="text-xs text-gray-500 mb-3">Central pharmaceutical catalog with standard medical codes.</p>
              <div className="bg-gray-50 p-3 rounded font-mono text-xs text-gray-700 leading-normal">
                - <b>id</b>: VARCHAR(10) PRIMARY KEY<br />
                - <b>name</b>: VARCHAR(100) NOT NULL<br />
                - <b>genericName</b>: VARCHAR(100) NOT NULL<br />
                - <b>barcode</b>: VARCHAR(50) UNIQUE NOT NULL<br />
                - <b>sku</b>: VARCHAR(30) UNIQUE NOT NULL<br />
                - <b>category</b>: VARCHAR(50) NOT NULL<br />
                - <b>price</b>: NUMERIC(10,2) NOT NULL [selling price]<br />
                - <b>buyingPrice</b>: NUMERIC(10,2) NOT NULL<br />
                - <b>isPrescriptionRequired</b>: BOOLEAN DEFAULT FALSE<br />
                - <b>unit</b>: VARCHAR(20) [e.g., "Box"]<br />
                - <b>minStockLevel</b>: INTEGER DEFAULT 10
              </div>
            </div>

            <div className="border border-gray-150 rounded-lg p-4">
              <h3 className="text-sm font-sans font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                Table: <code className="text-emerald-700">stockItems</code> (Batch Level)
              </h3>
              <p className="text-xs text-gray-500 mb-3">Branch-specific physical inventory tracked at individual batch levels.</p>
              <div className="bg-gray-50 p-3 rounded font-mono text-xs text-gray-700 leading-normal">
                - <b>id</b>: VARCHAR(10) PRIMARY KEY<br />
                - <b>medicineId</b>: REFERENCES medicines(id)<br />
                - <b>branchId</b>: REFERENCES branches(id)<br />
                - <b>batchNumber</b>: VARCHAR(50) NOT NULL<br />
                - <b>expiryDate</b>: DATE NOT NULL [YYYY-MM-DD]<br />
                - <b>quantity</b>: INTEGER NOT NULL DEFAULT 0<br />
                - <b>buyingPrice</b>: NUMERIC(10,2) NOT NULL<br />
                - <b>supplierId</b>: REFERENCES suppliers(id)<br />
                - <b>isDamaged</b>: BOOLEAN DEFAULT FALSE
              </div>
            </div>

            <div className="border border-gray-150 rounded-lg p-4">
              <h3 className="text-sm font-sans font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                Table: <code className="text-emerald-700">sales</code> &amp; <code className="text-emerald-700">saleItems</code>
              </h3>
              <p className="text-xs text-gray-500 mb-3">POS transaction log linked with customers and cashier details.</p>
              <div className="bg-gray-50 p-3 rounded font-mono text-xs text-gray-700 leading-normal">
                - <b>id</b>: VARCHAR(10) PRIMARY KEY<br />
                - <b>invoiceNumber</b>: VARCHAR(30) UNIQUE NOT NULL<br />
                - <b>branchId</b>: REFERENCES branches(id)<br />
                - <b>cashierId</b>: REFERENCES users(id)<br />
                - <b>customerId</b>: REFERENCES customers(id) NULLABLE<br />
                - <b>total</b>: NUMERIC(12,2) [VAT Inclusive]<br />
                - <b>paymentMethod</b>: ENUM('Cash', 'Card', 'Credit')<br />
                - <b>status</b>: ENUM('Completed', 'Returned')
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'api' && (
        <div className="space-y-4 font-sans">
          <h3 className="text-sm font-semibold text-gray-800">RESTful Express API Documentation</h3>
          <p className="text-xs text-gray-500">Secure API router mapped with JWT / user session permissions.</p>

          <div className="overflow-x-auto border border-gray-150 rounded-lg">
            <table className="min-w-full text-left text-xs text-gray-700">
              <thead className="bg-gray-50 border-b border-gray-150 font-medium text-gray-900">
                <tr>
                  <th className="p-3">Method</th>
                  <th className="p-3">Route</th>
                  <th className="p-3">Required Payload / Query</th>
                  <th className="p-3">Target Scope</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="p-3 font-semibold text-blue-600">POST</td>
                  <td className="p-3 font-mono">/api/auth/login</td>
                  <td className="p-3 font-mono">{"{ username, password }"}</td>
                  <td className="p-3 text-gray-600">Public (Session initialization &amp; 2FA check)</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-blue-600">POST</td>
                  <td className="p-3 font-mono">/api/auth/verify-2fa</td>
                  <td className="p-3 font-mono">{"{ userId, code }"}</td>
                  <td className="p-3 text-gray-600">Verifies OTP (admin: 123456)</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-emerald-600">GET</td>
                  <td className="p-3 font-mono">/api/medicines</td>
                  <td className="p-3 text-gray-500">None</td>
                  <td className="p-3 text-gray-600">Reads master drug catalog</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-blue-600">POST</td>
                  <td className="p-3 font-mono">/api/sales</td>
                  <td className="p-3 font-mono">{"{ branchId, cashierId, paymentMethod, items: [{medicineId, quantity, selectedBatchId}], discount }"}</td>
                  <td className="p-3 text-gray-600">POS checkout. Runs atomic stock deductions and verifies credit limit.</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-red-600">POST</td>
                  <td className="p-3 font-mono">/api/sales/refund</td>
                  <td className="p-3 font-mono">{"{ saleId, operatorId, reason }"}</td>
                  <td className="p-3 text-gray-600">Returns items to inventory and reverses credit/loyalty.</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-blue-600">POST</td>
                  <td className="p-3 font-mono">/api/transfers</td>
                  <td className="p-3 font-mono">{"{ sourceBranchId, targetBranchId, items: [{medicineId, quantity, batchNumber, expiryDate}] }"}</td>
                  <td className="p-3 text-gray-600">Inter-branch inventory movement request.</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-emerald-600">GET</td>
                  <td className="p-3 font-mono">/api/backup/export</td>
                  <td className="p-3 text-gray-500">None</td>
                  <td className="p-3 text-gray-600">Super Admin only. Triggers raw database JSON file download.</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-blue-600">POST</td>
                  <td className="p-3 font-mono">/api/backup/restore</td>
                  <td className="p-3 font-mono">{"{ backupContent, operatorId }"}</td>
                  <td className="p-3 text-gray-600">Super Admin only. Validates schemas, parses legacy XML/desktop data, and commits.</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-150 mt-4">
            <h4 className="text-xs font-semibold text-gray-700 mb-2">JSON REST Error Code Specs</h4>
            <ul className="text-xs text-gray-600 space-y-1.5 list-disc list-inside">
              <li><code className="text-red-700 font-semibold bg-red-50 px-1 rounded">401 Unauthorized</code>: Session token expired or authentication keys mismatch.</li>
              <li><code className="text-red-700 font-semibold bg-red-50 px-1 rounded">403 Forbidden</code>: Role lacks permission to access scope or account is deactivated.</li>
              <li><code className="text-red-700 font-semibold bg-red-50 px-1 rounded">400 Bad Request</code>: Stock levels insufficient, expired drug validation, or duplicate item key constraints.</li>
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'install' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Enterprise Deployment Guide</h3>
            <p className="text-xs text-gray-500 mb-4">
              Sonan Pharmacy Management System can be deployed locally on a branch server or containerized on AWS/GCP for central operations.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5" />
                1. Local / Branch Server Installation (Windows &amp; Linux)
              </span>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs mt-2 overflow-x-auto space-y-1">
                <span className="text-gray-400"># Clone application from company portal</span><br />
                <span>git clone https://github.com/sonan-pharmacy/enterprise-pms.git</span><br />
                <span>cd enterprise-pms</span><br />
                <span className="text-gray-400"># Install dependencies</span><br />
                <span>npm install</span><br />
                <span className="text-gray-400"># Set up environment variables</span><br />
                <span>cp .env.example .env</span><br />
                <span className="text-gray-400"># Build project for production</span><br />
                <span>npm run build</span><br />
                <span className="text-gray-400"># Spin up backend server</span><br />
                <span>npm run start</span>
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5" />
                2. Containerized Deployment (Docker Support)
              </span>
              <p className="text-xs text-gray-500 mt-1">Deploy securely to Cloud environments with Docker Compose.</p>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs mt-2 overflow-x-auto">
                <span className="text-gray-500"># Dockerfile</span><br />
                <span className="text-emerald-400">FROM</span> node:20-alpine AS builder<br />
                <span className="text-emerald-400">WORKDIR</span> /app<br />
                <span className="text-emerald-400">COPY</span> package*.json ./<br />
                <span className="text-emerald-400">RUN</span> npm ci<br />
                <span className="text-emerald-400">COPY</span> . .<br />
                <span className="text-emerald-400">RUN</span> npm run build<br /><br />
                <span className="text-emerald-400">FROM</span> node:20-alpine<br />
                <span className="text-emerald-400">WORKDIR</span> /app<br />
                <span className="text-emerald-400">COPY</span> --from=builder /app/dist ./dist<br />
                <span className="text-emerald-400">COPY</span> --from=builder /app/package*.json ./<br />
                <span className="text-emerald-400">RUN</span> npm ci --only=production<br />
                <span className="text-emerald-400">EXPOSE</span> 3000<br />
                <span className="text-emerald-400">CMD</span> ["node", "dist/server.cjs"]
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'backup' && (
        <div className="space-y-6">
          <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg flex gap-3 text-xs leading-relaxed border border-yellow-200">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block mb-1">Backup Safety Protocol</span>
              Restoring a system replaces operational state on the selected branch or globally. Always trigger a manual download of the current database before triggering any restoration wizard to prevent unexpected data overrides.
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-800">Auto-Format Mapping Engine</h4>
            <p className="text-xs text-gray-500">
              The Migration Wizard implements three translation layers to detect source formats automatically:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 border border-gray-150 rounded-lg">
                <h5 className="text-xs font-semibold text-gray-900 mb-1">V2 Web System Backup</h5>
                <p className="text-[11px] text-gray-500">Full system image containing complete relational schema. Preserves audit logs, historical stock transfers, and financial ledger data across branches with matching unique ID signatures.</p>
              </div>
              <div className="p-3 border border-gray-150 rounded-lg">
                <h5 className="text-xs font-semibold text-gray-900 mb-1">Legacy V1 Desktop App</h5>
                <p className="text-[11px] text-gray-500">Detects key entities like <code className="bg-gray-100 px-0.5 rounded">Medicines</code> or <code className="bg-gray-100 px-0.5 rounded">Customers</code>. Automatically maps old attributes (e.g., RxRequired, MinStock) to modern structures and injects initial stock entries directly to Main Branch.</p>
              </div>
              <div className="p-3 border border-gray-150 rounded-lg">
                <h5 className="text-xs font-semibold text-gray-900 mb-1">Standard Web Export</h5>
                <p className="text-[11px] text-gray-500">Parses items arrays containing simple medicine listings, generating unique identifiers and checking for barcode collisions before pushing catalog updates.</p>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <h5 className="text-xs font-semibold text-gray-700 mb-2">Relational Validation Constraints Checked:</h5>
              <ol className="list-decimal list-inside text-xs text-gray-600 space-y-1">
                <li><b>Integrity Lock</b>: Every inventory batch item must point to a registered Medicine ID. Unmapped records trigger a transaction abort and rolling rollback.</li>
                <li><b>Location Isolation</b>: Branch IDs must exist in the branches registry. Cannot map stock to imaginary branches.</li>
                <li><b>Duplicate Lock</b>: Barcodes and SKU codes are checked globally. Existing records are skipped with detailed error descriptions to prevent duplicate inventory.</li>
                <li><b>Invoice Ledger Continuity</b>: Sale invoices must map to registered medicine entities. No partial sales tracking is allowed.</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
