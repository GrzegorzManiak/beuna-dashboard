import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

export function ProcessingStep() {
    return (
        <Card className="w-full pb-0 max-w-2xl h-120">
            <CardContent className="flex flex-col items-center justify-center py-12 h-full">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="mb-6"
                >
                    <Loader2 className="w-12 h-12 text-emerald-500" />
                </motion.div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Analyzing Document</h3>
                <p className="text-gray-500 text-center max-w-sm">
                    We are extracting property details from your uploaded document. This will just take a moment.
                </p>
            </CardContent>
        </Card>
    );
}
