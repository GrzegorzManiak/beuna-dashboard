import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type PropertyTypeSelection = "condo" | "rental";

type PropertyTypePickerProps = {
    onNext: () => void;
    onBack: () => void;
    selectedType: PropertyTypeSelection | null;
    onSelect: (value: PropertyTypeSelection) => void;
    isSubmitting?: boolean;
    errorMessage?: string | null;
};

export function PropertyTypePicker({
    onNext,
    onBack,
    selectedType,
    onSelect,
    isSubmitting = false,
    errorMessage,
}: PropertyTypePickerProps) {
    return (
        <Card className="w-full pb-0 max-w-2xl">
            <CardHeader className="mb-2">
                <CardTitle className="font-black text-2xl">What kind of property is this?</CardTitle>
                <CardDescription>
                    Choose how this property is legally managed. You can change this later.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-row gap-8 h-full">
                <CardAction className="w-full" onClick={() => onSelect("condo")}>
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
                                src="/property_types/weg.png"
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

                <CardAction className="w-full" onClick={() => onSelect("rental")}>
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
                                src="/property_types/mv.png"
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
            <CardFooter className="flex flex-col gap-2 bg-muted pt-4 pb-6 border-t mt-2">
                <div className="flex gap-4 w-full">
                    <Button onClick={onBack} variant="ghost" className="text-lg h-10 px-10 cursor-pointer">
                        Back
                    </Button>
                    <Button
                        onClick={onNext}
                        type="submit"
                        className="grow text-lg h-10 cursor-pointer"
                        disabled={!selectedType || isSubmitting}
                    >
                        {isSubmitting ? "Saving..." : "Continue"}
                    </Button>
                </div>
                {errorMessage ? <p className="text-xs font-medium text-red-600">{errorMessage}</p> : null}
            </CardFooter>
        </Card>
    );
}
