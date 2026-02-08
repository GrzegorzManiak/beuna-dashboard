
const mockSections = [
    {
        id: "section-3",
        textPosition: {
            page: [1, 2],
            x: 300,
            y: 850,
            width: 200,
            height: 500,
        },
    }
];

const pageMetrics = {
    1: { originalWidth: 600, originalHeight: 1000, scale: 1.12, height: 1120 },
    2: { originalWidth: 600, originalHeight: 1000, scale: 1.12, height: 1120 },
};

function calculateSectionStyle(
    pageNumber,
    section,
    pageMetrics
) {
    const metrics = pageMetrics[pageNumber];
    const scale = metrics?.scale || 1;
    const startPage = section.textPosition.page[0];
    
    // Log what we are calculating
    console.log(`Calculating for Page ${pageNumber}, Section ${section.id}`);
    console.log(`Scale: ${scale}`);
    
    const sectionRect = {
        left: section.textPosition.x * scale,
        width: section.textPosition.width * scale,
        top: 0,
        height: 0,
        hasTopBorder: pageNumber === startPage,
        hasBottomBorder: pageNumber === section.textPosition.page[section.textPosition.page.length - 1],
    };

    if (pageNumber === startPage) {
        sectionRect.top = section.textPosition.y * scale;

        const pageOriginalHeight = metrics?.originalHeight || 0;
        const availableHeight = Math.max(0, pageOriginalHeight - section.textPosition.y);

        const unscaledHeight = Math.min(section.textPosition.height, availableHeight);
        sectionRect.height = unscaledHeight * scale;
        
        console.log(`Page Start: Unscaled Height consumed: ${unscaledHeight}`);
    } else {
        sectionRect.top = 0; 
        let remainingHeight = section.textPosition.height;

        let currentPage = startPage;
        while (currentPage < pageNumber) {
            const m = pageMetrics[currentPage];
            if (m) {
                if (currentPage === startPage) {
                    const consumed = Math.max(0, m.originalHeight - section.textPosition.y);
                    remainingHeight -= consumed;
                    console.log(`Subsequent: Consumed from Page ${currentPage}: ${consumed}`);
                }
                else {
                    remainingHeight -= m.originalHeight;
                    console.log(`Subsequent: Consumed from Page ${currentPage}: ${m.originalHeight}`);
                }
            }
            currentPage++;
        }
        
        console.log(`Remaining Height before this page: ${remainingHeight}`);

        const pageOriginalHeight = metrics?.originalHeight || 0;
        const unscaledHeight = Math.min(Math.max(0, remainingHeight), pageOriginalHeight);

        if (remainingHeight <= 0) sectionRect.height = 0;
        else sectionRect.height = unscaledHeight * scale;
    }

    return {
        style: {
            left: sectionRect.left,
            top: sectionRect.top,
            width: sectionRect.width,
            height: sectionRect.height,
        },
    };
}

const s1 = calculateSectionStyle(1, mockSections[0], pageMetrics);
console.log('Page 1 Style:', s1.style);

const s2 = calculateSectionStyle(2, mockSections[0], pageMetrics);
console.log('Page 2 Style:', s2.style);
