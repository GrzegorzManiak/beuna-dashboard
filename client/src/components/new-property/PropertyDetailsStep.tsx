import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PropertyDetailsStepProps = {
    onNext: () => void;
    onBack: () => void;
    name: string;
    onNameChange: (value: string) => void;
    street: string;
    onStreetChange: (value: string) => void;
    postalCode: string;
    onPostalCodeChange: (value: string) => void;
    city: string;
    onCityChange: (value: string) => void;
    isSubmitting?: boolean;
    errorMessage?: string | null;
};

export function PropertyDetailsStep({
    onNext,
    onBack,
    name,
    onNameChange,
    street,
    onStreetChange,
    postalCode,
    onPostalCodeChange,
    city,
    onCityChange,
    isSubmitting = false,
    errorMessage,
}: PropertyDetailsStepProps) {
    return (
        <Card className="w-full pb-0 max-w-2xl">
            <CardHeader className="mb-2">
                <CardTitle className="font-black text-2xl">Property details</CardTitle>
                <CardDescription>
                    We've filled in what we could from your documents. Please confirm the basics - You'll have a chance
                    to review everything before finalizing.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-7">
                <div className="space-y-2">
                    <Label htmlFor="propertyName">Property name</Label>
                    <Input
                        className="p-5"
                        id="propertyName"
                        value={name}
                        onChange={(event) => onNameChange(event.target.value)}
                        placeholder="e.g. Sunset Apartments"
                    />
                </div>

                <div className="space-y-2">
                    <Label>Registered property address</Label>
                    <Input
                        value={street}
                        onChange={(event) => onStreetChange(event.target.value)}
                        placeholder="Street"
                        className="mb-2 p-5"
                    />
                    <div className="flex gap-2">
                        <Input
                            value={postalCode}
                            onChange={(event) => onPostalCodeChange(event.target.value)}
                            placeholder="Postcode"
                            className="w-1/3 p-5"
                        />
                        <Input
                            value={city}
                            onChange={(event) => onCityChange(event.target.value)}
                            placeholder="City"
                            className="w-2/3 p-5"
                        />
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 bg-muted pt-4 pb-6 border-t mt-2">
                <div className="flex gap-4 w-full">
                    <Button onClick={onBack} variant="ghost" className="text-lg h-10 px-10 cursor-pointer">
                        Back
                    </Button>
                    <Button onClick={onNext} className="grow text-lg h-10 cursor-pointer" disabled={isSubmitting}>
                        {isSubmitting ? "Saving..." : "Continue"}
                    </Button>
                </div>
                {errorMessage ? <p className="text-xs font-medium text-red-600">{errorMessage}</p> : null}
            </CardFooter>
        </Card>
    );
}
