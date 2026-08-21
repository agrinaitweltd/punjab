import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'})
  const x=req.body??{}; if(!x.customer?.name||!x.invoice?.number)return res.status(400).json({error:'Customer and invoice are required'})
  const pdf=await PDFDocument.create(),page=pdf.addPage([595,842]),bold=await pdf.embedFont(StandardFonts.HelveticaBold),regular=await pdf.embedFont(StandardFonts.Helvetica)
  const green=rgb(.08,.31,.17),muted=rgb(.35,.4,.37); page.drawRectangle({x:0,y:810,width:595,height:32,color:green})
  page.drawText('Punjab Exotic Foods Limited',{x:42,y:760,size:22,font:bold,color:green}); page.drawText('PAYMENT DUE NOTICE',{x:42,y:714,size:26,font:bold,color:rgb(.72,.12,.1)}); page.drawText('PAYMENT DUE TODAY',{x:42,y:680,size:13,font:bold,color:rgb(.72,.12,.1)})
  const rows=[['Customer',x.customer.name],['Account Number',x.customer.accountNumber],['Email',x.customer.email],['Telephone',x.customer.phone],['Invoice Number',x.invoice.number],['Invoice Date',x.invoice.date],['Due Date',x.invoice.dueDate],['Original Invoice Total',`£${Number(x.invoice.total||0).toFixed(2)}`],['Amount Paid',`£${Number(x.invoice.paid||0).toFixed(2)}`],['Outstanding Balance',`£${Number(x.invoice.outstanding||0).toFixed(2)}`]]
  let y=630; for(const [label,value] of rows){page.drawText(label,{x:42,y,size:10,font:bold,color:muted});page.drawText(String(value||'—'),{x:230,y,size:11,font:regular,color:rgb(.08,.1,.09)});page.drawLine({start:{x:42,y:y-8},end:{x:550,y:y-8},thickness:.5,color:rgb(.85,.87,.85)});y-=38}
  page.drawText('Please ensure payment is made immediately in accordance with the agreed payment terms.',{x:42,y:205,size:10,font:regular,color:muted});page.drawText('receivables@punjabexoticfoods.com  |  020 8558 2867',{x:42,y:180,size:10,font:bold,color:green})
  const bytes=await pdf.save(); const safe=String(x.invoice.number).replace(/[^a-zA-Z0-9_-]/g,'_');res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="Payment-Due-${safe}.pdf"`);return res.status(200).send(Buffer.from(bytes))
}
