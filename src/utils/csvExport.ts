import { IncomingLotRecord, OutgoingRecord, TOMATO_VARIETIES } from '../types/qc';
import { daysBetweenIsoDates, getMixLotNumbers } from './lotHelpers';

/**
 * Escapes a cell value for standard RFC 4180 CSV format.
 * Encapsulates in quotes if it contains commas, newlines, or quotes.
 */
function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) {
    return '""';
  }
  const str = String(val);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Initiates browser download of a CSV file with UTF-8 BOM.
 * UTF-8 BOM (\uFEFF) ensures Thai characters display correctly in Excel and other spreadsheet software.
 */
export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports Incoming QC Lot Records to CSV file.
 */
export function exportIncomingLotsToCsv(
  lots: IncomingLotRecord[],
  customFilename?: string
): void {
  const headers = [
    'เลขที่ล็อต (Lot No.)',
    'รหัสสายพันธุ์ (Variety Code)',
    'ชื่อสายพันธุ์ (Variety Name)',
    'เฉดสี (Color)',
    'วันที่ตรวจรับ (Received Date)',
    'เวลาตรวจรับ (Received Time)',
    'ไร้เศษดินทรายตกค้าง',
    'ไร้แมลงมีชีวิต',
    'ไร้เศษแก้ว/โลหะ/พลาสติก',
    'ไร้กลิ่นผิดปกติ/หมักหมม',
    'สรุปสิ่งแปลกปลอมและความสะอาด',
    'ผลการตัดสินตรวจรับ (Disposition)',
    'แผนการคัดแยก (Sorting Plan)',
    'คาดการณ์สูญเสียจากการคัด (%)',
    'เหตุผลการปฏิเสธล็อต (Reject Reason)',
    'ผู้ตรวจสอบรับเข้า (Inspector)',
    'หมายเหตุ (Remarks)',
  ];

  const rows = lots.map((lot) => {
    const v = TOMATO_VARIETIES[lot.varietyCode];
    const foreign = lot.foreignMatter;
    const isCleanPass =
      foreign?.noSoilResidue &&
      foreign?.noLiveInsects &&
      foreign?.noPhysicalHazard &&
      foreign?.noAbnormalOdor;

    const dispositionLabel =
      lot.disposition === 'ACCEPT'
        ? 'รับเข้าปกติ (ACCEPT)'
        : lot.disposition === 'CONDITIONAL_ACCEPT'
        ? 'รับเข้าเงื่อนไขพิเศษ (CONDITIONAL ACCEPT)'
        : 'ปฏิเสธรับเข้า (REJECT)';

    return [
      lot.lotNumber,
      lot.varietyCode,
      v ? v.nameTh : lot.varietyCode,
      v ? v.colorLabelTh : '',
      lot.receivedDate,
      lot.receivedTime || '-',
      foreign?.noSoilResidue ? 'ผ่าน' : 'พบเศษดินทราย',
      foreign?.noLiveInsects ? 'ผ่าน' : 'พบแมลงมีชีวิต',
      foreign?.noPhysicalHazard ? 'ผ่าน' : 'พบวัตถุแปลกปลอม',
      foreign?.noAbnormalOdor ? 'ผ่าน' : 'พบกลิ่นผิดปกติ',
      isCleanPass ? 'สะอาด ผ่านเกณฑ์ 100%' : (foreign?.cleanlinessNote || 'พบสิ่งแปลกปลอม'),
      dispositionLabel,
      lot.sortingPlan || '-',
      lot.sortingEstimatedLossPct !== undefined ? `${lot.sortingEstimatedLossPct}%` : '0%',
      lot.rejectReason || '-',
      lot.inspectorName,
      lot.remarks || '-',
    ];
  });

  const csvContent = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ].join('\r\n');

  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename =
    customFilename || `FreshTom_QC_Incoming_Lots_${todayStr}.csv`;

  downloadCsv(filename, csvContent);
}

/**
 * Exports Finished Goods (FG / OQC) Inspection Records to CSV file.
 */
export function exportOutgoingRecordsToCsv(
  records: OutgoingRecord[],
  customFilename?: string
): void {
  const headers = [
    'เลขที่เอกสารตรวจปล่อย (OQC No.)',
    'เลขที่ใบรับรอง (COA No.)',
    'รหัสล็อตการผลิตสินค้าสำเร็จรูป (FG Lot No.)',
    'วันที่ตรวจปล่อย (Inspection Date)',
    'เวลาตรวจปล่อย (Inspection Time)',
    'ชื่อคู่ค้า / ลูกค้า (Customer)',
    'ศูนย์กระจายสินค้าปลายทาง (DC)',
    'เลขที่ใบสั่งซื้อ (PO No.)',
    'ชื่อผลิตภัณฑ์ (Product Name)',
    'วันที่ผลิต (MFG Date)',
    'วันหมดอายุ (EXP Date)',
    'อายุการเก็บรักษา (วัน / Shelf Life)',
    'จำนวนสายพันธุ์ที่คละสี (Variety Count)',
    'สูตรคละสีและล็อตวัตถุดิบ (Mix Formula & Source Lots)',
    '1. การปิดผนึกฝากล่อง (Lid Sealing)',
    '2. ผสมสี 3-5 สีตามเกณฑ์ (Color Mix Valid)',
    '3. ฉลาก MFG/EXP และล้างก่อนทาน (Label & Wash Warning)',
    '4. น้ำหนักสุทธิ ≥ 140g (Net Weight Pass)',
    'น้ำหนักสุทธิตรวจวัด (กรัม / g)',
    'น้ำหนักสุ่มตัวอย่าง 10 กล่อง (Sample Weights g)',
    '5. กายภาพ ไม่ช้ำ ไร้หยดน้ำ (Physical Quality)',
    '6. ยอดบรรจุตรงใบสั่งซื้อ (Quantity Match)',
    'ยอดสั่งซื้อ (แพ็ค / Ordered Packs)',
    'ยอดบรรจุจริง (แพ็ค / Actual Packs)',
    'จำนวนตะกร้าขนส่ง (Crates)',
    '7. ควบคุมความเย็น 2-6 °C (Room Temp Pass)',
    'อุณหภูมิห้องจัดเตรียม (°C)',
    '8. ตะกร้าสะอาดฆ่าเชื้อ (Sanitized Crates)',
    'สรุปผลตรวจปล่อย FG (OQC Status)',
    'ผู้ตรวจสอบคุณภาพ (FG Inspector)',
    'หมายเหตุ (Remarks)',
  ];

  const rows = records.map((rec) => {
    const shelfDays = daysBetweenIsoDates(rec.mfgDate, rec.expDate);
    const activeMix = rec.colorMix.filter((c) => c.percentage > 0);
    const mixDetails = activeMix
      .map((c) => {
        const v = TOMATO_VARIETIES[c.varietyCode];
        const name = v ? v.nameTh : c.varietyCode;
        const lots = getMixLotNumbers(c).join(';');
        return `${name} (${c.percentage}% | ล็อต: ${lots || 'N/A'})`;
      })
      .join(' | ');

    const sampleWeightsStr = rec.sampleWeights && rec.sampleWeights.length > 0
      ? rec.sampleWeights.join(', ')
      : `${rec.netWeightG}`;

    return [
      rec.oqcNumber,
      rec.coaNumber,
      rec.productionLotNo || rec.oqcNumber,
      rec.inspectionDate,
      rec.inspectionTime || '-',
      rec.customerName,
      rec.distributionCenter || '-',
      rec.poNumber,
      rec.productName,
      rec.mfgDate,
      rec.expDate,
      shelfDays !== null ? `${shelfDays} วัน` : '6 วัน',
      activeMix.length,
      mixDetails,
      rec.check1LidSealing ? 'ผ่าน (PASS)' : 'ไม่ผ่าน (FAIL)',
      rec.check2MixValid ? 'ผ่าน (PASS)' : 'ไม่ผ่าน (FAIL)',
      rec.check3ExpiryLabel && rec.check3WashLabel ? 'ผ่าน (PASS)' : 'ไม่ผ่าน (FAIL)',
      rec.check4NetWeightPass ? 'ผ่าน (PASS)' : 'ไม่ผ่าน (FAIL)',
      rec.netWeightG,
      sampleWeightsStr,
      rec.check5Physical ? 'ผ่าน (PASS)' : 'ไม่ผ่าน (FAIL)',
      rec.check6QtyMatch ? 'ผ่าน (PASS)' : 'ไม่ผ่าน (FAIL)',
      rec.orderedPacks,
      rec.actualPacks,
      rec.crateQty,
      rec.check7RoomTempPass ? 'ผ่าน (PASS)' : 'ไม่ผ่าน (FAIL)',
      rec.roomTempC.toFixed(1),
      rec.check8CrateClean ? 'ผ่าน (PASS)' : 'ไม่ผ่าน (FAIL)',
      rec.oqcStatus === 'PASS' ? 'ผ่านเกณฑ์ (PASS)' : 'ไม่ผ่านเกณฑ์ (FAIL)',
      rec.oqcInspector,
      rec.oqcRemarks || '-',
    ];
  });

  const csvContent = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ].join('\r\n');

  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename =
    customFilename || `FreshTom_QC_FG_Outgoing_${todayStr}.csv`;

  downloadCsv(filename, csvContent);
}
