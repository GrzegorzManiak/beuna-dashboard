import type { Ref } from "react";

type PdfSplitToolbarProps = {
    closeSplit: () => void;
    splitToolbarRef: Ref<HTMLDivElement>;
};

function PdfSplitToolbar({ closeSplit, splitToolbarRef }: PdfSplitToolbarProps) {
    return (
        <div
            id="pdf-split-toolbar"
            ref={splitToolbarRef}
            className="pointer-events-auto mx-auto gap-2 w-full bg-white p-5 flex justify-center border border-gray-300"
        >
            <button onClick={() => closeSplit()} className="rounded bg-red-500 px-3 py-1 text-white">
                Close Split
            </button>
        </div>
    );
}

export {
    PdfSplitToolbar
}