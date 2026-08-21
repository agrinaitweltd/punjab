import assert from 'node:assert/strict'
import fs from 'node:fs'
import PizZip from 'pizzip'
import invoiceDoc from '../api/generate-invoice-docx.js'
import duePdf from '../api/generate-payment-due-pdf.js'

async function invoke(handler, body) { let status=200, output, type=''; const req={method:'POST',body}; const res={status(n){status=n;return this},json(x){output=x;return this},setHeader(k,v){if(k==='Content-Type')type=v},send(x){output=x;return this}}; await handler(req,res); return {status,output,type} }
const customer={name:'CBD Supply Chain UK Co Ltd',accountNumber:'828310',addressLine1:'Gate 9',addressLine2:'9 High Brook Road',postcode:'SE3 8AG',phone:'07825708296',email:'test@example.com',balance:23521}
const invoice={invoiceNumber:'TEST-828310',date:'21/08/2026',packages:2,totalGoods:30,vatTotal:1,grandTotal:31}
const items=[{line:'262802',qty:1,product:'BANANA',variety:'FYFFES',size:'18KG',price:16.5,vatRate:0},{line:'262803',qty:2,product:'MANGO',variety:'KENT',size:'6KG',price:6.75,vatRate:7.4074}]
const doc=await invoke(invoiceDoc,{customer,invoice,items});assert.equal(doc.status,200);const xml=new PizZip(doc.output).file('word/document.xml').asText();for(const expected of ['CBD Supply Chain UK Co Ltd','828310','BANANA','MANGO','31.00'])assert.ok(xml.includes(expected),`DOCX missing ${expected}`);assert.ok(!xml.includes('[LINE]'))
const pdf=await invoke(duePdf,{customer,invoice:{number:'TEST-828310',date:'2026-08-01',dueDate:'2026-08-21',total:100,paid:25,outstanding:75}});assert.equal(pdf.status,200);assert.equal(pdf.type,'application/pdf');assert.equal(Buffer.from(pdf.output).subarray(0,4).toString(),'%PDF')
const migration=fs.readFileSync(new URL('../sql/migrations/004_finance_communications_and_documents.sql',import.meta.url),'utf8');for(const required of ['create table if not exists expenses','create table if not exists communication_logs','communication_logs_idempotency_key_uidx','invoice_items_invoice_id_idx'])assert.ok(migration.includes(required),`Migration missing ${required}`)
console.log('Finance workflow tests passed')
