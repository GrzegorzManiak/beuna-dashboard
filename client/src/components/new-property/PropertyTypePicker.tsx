import { useState } from "react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type PropertyTypeSelection = "condo" | "rental";

type PropertyTypePickerProps = {
    onNext: () => void;
    onBack: () => void;
};

export function PropertyTypePicker({ onNext, onBack }: PropertyTypePickerProps) {
    const [selectedType, setSelectedType] = useState<PropertyTypeSelection | null>(null);

    return (
        <Card className="w-full pb-0 max-w-2xl">
            <CardHeader className="mb-2">
                <CardTitle className="font-black text-2xl">What kind of property is this?</CardTitle>
                <CardDescription>
                    Choose how this property is legally managed. You can change this later.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-row gap-8 h-full">
                <CardAction className="w-full" onClick={() => setSelectedType("condo")}>
                    <div
                        className={cn(
                            "transition-all rounded-lg border-2 border-transparent cursor-pointer",
                            selectedType === "condo"
                                ? "p-2 border-emerald-500 bg-emerald-50 rounded-lg"
                                : " hover:border-gray-300",
                        )}
                    >
                        <AspectRatio ratio={1}>
                            <img
                                src="https://buena-case-study.preview.buena.com/images/8e48b6e0-1c0b-4ccf-b809-b63eabbb67e9.png"
                                alt="WEG (Condominium)"
                            />
                        </AspectRatio>

                        <div className="w-full h-full flex flex-col items-center justify-center">
                            <Label htmlFor="condo" className="text-lg font-bold text-foreground/95 text-center">
                                WEG - Condominium
                            </Label>
                            <p className="mt-1 px-2 text-sm text-gray-600 text-center leading-tight mb-1">
                                Shared ownership of common areas. Voting & ownership shares matter
                            </p>
                        </div>
                    </div>
                </CardAction>

                <CardAction className="w-full" onClick={() => setSelectedType("rental")}>
                    <div
                        className={cn(
                            "transition-all rounded-lg border-2 border-transparent cursor-pointer",
                            selectedType === "rental"
                                ? "p-2 border-emerald-500 bg-emerald-50 rounded-lg"
                                : " hover:border-gray-300",
                        )}
                    >
                        <AspectRatio ratio={1}>
                            <img
                                src="https://buena-case-study.preview.buena.com/images/76556c9e-f1e2-4496-9144-d261fce7f6d1.png"
                                alt="MV (Rental)"
                            />
                        </AspectRatio>

                        <div className="w-full h-full flex flex-col items-center justify-center">
                            <Label htmlFor="rental" className="text-lg font-bold text-foreground/95 text-center">
                                MV - Rental
                            </Label>
                            <p className="mt-1 px-2 text-sm text-gray-600 text-center leading-tight mb-1">
                                Multiple rental units. No ownership shares or voting
                            </p>
                        </div>
                    </div>
                </CardAction>
            </CardContent>
            <CardFooter className="flex gap-4 bg-muted pt-4 pb-6 border-t mt-2">
                <Button onClick={onBack} variant="ghost" className="text-lg h-10 px-10 cursor-pointer">
                    Back
                </Button>
                <Button
                    onClick={onNext}
                    type="submit"
                    className="grow text-lg h-10 cursor-pointer"
                    disabled={!selectedType}
                >
                    Continue
                </Button>
            </CardFooter>
        </Card>
    );
}
