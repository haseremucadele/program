import VehicleDetailClient from './VehicleDetailClient';

interface PageProps {
    params: Promise<{ id: string }>;
}

export function generateStaticParams() {
    return [];
}

export default async function VehicleDetailPage({ params }: PageProps) {
    const { id } = await params;
    return <VehicleDetailClient id={id} />;
}
