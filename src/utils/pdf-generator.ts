import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DeliveryReportData {
    deliveryDate: string;
    district: string;
    items: { productName: string; amount: number; unit: string }[];
    receiverName: string;
    delivererName: string;
    description: string;
}

export const loadFonts = async (doc: jsPDF) => {
    const fonts = [
        {
            url: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf',
            name: 'Roboto',
            style: 'normal'
        },
        {
            url: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf',
            name: 'Roboto',
            style: 'bold'
        }
    ];

    for (const font of fonts) {
        try {
            const response = await fetch(font.url);
            if (!response.ok) throw new Error(`Failed to fetch ${font.url}`);
            const blob = await response.blob();
            const reader = new FileReader();

            await new Promise((resolve, reject) => {
                reader.onloadend = () => {
                    const base64data = reader.result?.toString().split(',')[1];
                    if (base64data) {
                        doc.addFileToVFS(`${font.name}-${font.style}.ttf`, base64data);
                        doc.addFont(`${font.name}-${font.style}.ttf`, font.name, font.style);
                    }
                    resolve(true);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.warn(`Font loading failed for ${font.style}:`, error);
        }
    }
};

export const commonTableStyles = {
    theme: 'grid' as const,
    headStyles: {
        fillColor: [255, 255, 255] as [number, number, number],
        textColor: 0,
        fontStyle: 'bold' as const,
        halign: 'left' as const,
        font: 'Roboto',
        lineWidth: 0.1,
        lineColor: 200
    },
    bodyStyles: {
        font: 'Roboto',
        fontStyle: 'normal' as const,
        textColor: 50
    },
    styles: {
        font: 'Roboto',
        fontSize: 10,
        cellPadding: 3,
        overflow: 'linebreak' as const
    }
};

export const generateDeliveryReport = async (data: DeliveryReportData) => {
    const doc = new jsPDF();
    await loadFonts(doc);
    doc.setFont('Roboto', 'normal');

    // Header
    doc.setFontSize(16);
    doc.text('HAŞERE MÜCADELE STOK TESLİM TUTANAĞI', 105, 25, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`Tarih: ${data.deliveryDate}`, 190, 40, { align: 'right' });
    doc.text(`İlçe: ${data.district}`, 14, 40, { align: 'left' });

    // Items Table
    const bodyData = data.items.map((item, index) => [
        index + 1,
        item.productName,
        `${item.amount} ${item.unit}`
    ]);

    autoTable(doc, {
        startY: 50,
        head: [['Sıra', 'Ürün Adı', 'Miktar']],
        body: bodyData,
        ...commonTableStyles,
        columnStyles: {
            0: { cellWidth: 20, halign: 'center' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 40, halign: 'right' }
        }
    });

    // Description (if any)
    let lastY = (doc as any).lastAutoTable.finalY + 10;
    if (data.description) {
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text('Açıklama:', 14, lastY);
        doc.setTextColor(50);
        doc.text(data.description, 30, lastY);
        lastY += 15;
    } else {
        lastY += 5;
    }

    // Signatures
    let sigY = lastY + 15;
    if (sigY > 250) {
        doc.addPage();
        sigY = 40;
    }

    doc.setFontSize(10);
    doc.setFont('Roboto', 'bold');
    doc.setTextColor(0);

    const leftColX = 55;
    const rightColX = 155;

    doc.text('TESLİM EDEN', leftColX, sigY, { align: 'center' });
    doc.text('TESLİM ALAN', rightColX, sigY, { align: 'center' });

    doc.setFont('Roboto', 'normal');
    doc.text(data.delivererName, leftColX, sigY + 8, { align: 'center' });
    doc.text(data.receiverName, rightColX, sigY + 8, { align: 'center' });

    doc.setTextColor(150);
    doc.text('İmza', leftColX, sigY + 25, { align: 'center' });
    doc.text('İmza', rightColX, sigY + 25, { align: 'center' });

    doc.setTextColor(100);
    doc.setFontSize(8);
    doc.text('Bu belge elektronik ortamda oluşturulmuştur.', 105, 290, { align: 'center' });

    const safeDistrict = data.district.replace(/[^a-z0-9]/gi, '_');
    doc.save(`Tutanak_${safeDistrict}_${Date.now()}.pdf`);
};

export const generateInventoryReport = async (items: any[]) => {
    const doc = new jsPDF();
    await loadFonts(doc);
    doc.setFont('Roboto', 'normal');

    doc.setFontSize(16);
    doc.text('DEPO ENVANTER RAPORU', 105, 25, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 190, 35, { align: 'right' });

    const bodyData = items.map((item, index) => [
        index + 1,
        item.urun_adi,
        `${item.stok_miktari} ${item.birim}`,
        item.kritik_limit
    ]);

    autoTable(doc, {
        startY: 40,
        head: [['Sıra', 'Ürün Adı', 'Stok', 'Kritik Limit']],
        body: bodyData,
        ...commonTableStyles
    });

    doc.save(`Depo_Envanteri_${Date.now()}.pdf`);
};

export const generateHistoryReport = async (history: any[]) => {
    const doc = new jsPDF('l'); // Landscape for more columns
    await loadFonts(doc);
    doc.setFont('Roboto', 'normal');

    doc.setFontSize(16);
    doc.text('STOK HAREKET GEÇMİŞİ', 148, 25, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 280, 35, { align: 'right' });

    const bodyData = history.map(h => [
        new Date(h.created_at).toLocaleString('tr-TR'),
        h.urun?.urun_adi || '-',
        h.islem_turu,
        `${h.miktar} ${h.urun?.birim || ''}`,
        h.ilce || '-',
        h.teslim_alan?.ad_soyad || '-',
        h.teslim_eden_id || '-'
    ]);

    autoTable(doc, {
        startY: 40,
        head: [['Tarih', 'Ürün', 'İşlem', 'Miktar', 'İlçe', 'Teslim Alan', 'Teslim Eden']],
        body: bodyData,
        ...commonTableStyles
    });

    doc.save(`Stok_Gecmisi_${Date.now()}.pdf`);
};

export const generateClothingReport = async (users: any[]) => {
    const doc = new jsPDF('l'); // Landscape
    await loadFonts(doc);
    doc.setFont('Roboto', 'normal');

    doc.setFontSize(16);
    doc.text('PERSONEL KIYAFET VE BEDEN LİSTESİ', 148, 25, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 280, 35, { align: 'right' });

    const bodyData = users.map((u, index) => [
        index + 1,
        u.ad_soyad || '-',
        u.ilce || '-',
        u.ayakkabi_no || '-',
        u.kislik_bot_no || '-',
        u.tisort_beden || '-',
        u.pantolon_beden || '-',
        u.sweatshirt_beden || '-',
        u.kislik_pantolon_beden || '-',
        u.mont_beden || '-'
    ]);

    autoTable(doc, {
        startY: 40,
        head: [['No', 'Ad Soyad', 'İlçe', 'Ayakkabı', 'Kışlık Bot', 'Tişört', 'Pantolon', 'Sweatshirt', 'Kışlık Pant.', 'Mont']],
        body: bodyData,
        ...commonTableStyles,
        columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 25 },
            3: { cellWidth: 20, halign: 'center' },
            4: { cellWidth: 20, halign: 'center' },
            5: { cellWidth: 20, halign: 'center' },
            6: { cellWidth: 20, halign: 'center' },
            7: { cellWidth: 25, halign: 'center' },
            8: { cellWidth: 25, halign: 'center' },
            9: { cellWidth: 20, halign: 'center' }
        }
    });

    doc.save(`Kiyafet_Listesi_${Date.now()}.pdf`);
};
