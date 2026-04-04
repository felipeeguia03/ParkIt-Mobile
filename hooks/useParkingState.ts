import { useState, useMemo } from "react";
import {
  ParkingZone,
  ParkingSpot,
  initialParkingData,
  getTotalStats,
} from "@/lib/parking-data";

export interface UserParking {
  zone: ParkingZone;
  spot: ParkingSpot;
  parkedAt: Date;
}

export function useParkingState() {
  const [zones, setZones] = useState<ParkingZone[]>(() => initialParkingData);
  const [selectedZone, setSelectedZone] = useState<ParkingZone | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [userParking, setUserParking] = useState<UserParking | null>(null);
  const [spotIndex, setSpotIndex] = useState(0);
  const [zoneFilter, setZoneFilter] = useState<string | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const totalStats = useMemo(() => getTotalStats(zones), [zones]);

  const availableSpots = useMemo(() => {
    const spots: { zone: ParkingZone; spot: ParkingSpot }[] = [];
    const filteredZones = zoneFilter
      ? zones.filter((z) => z.id === zoneFilter)
      : zones;
    filteredZones.forEach((zone) => {
      zone.spots.forEach((spot) => {
        if (spot.status === "available") {
          spots.push({ zone, spot });
        }
      });
    });
    return spots;
  }, [zones, zoneFilter]);

  const currentAvailableSpot = availableSpots[spotIndex] || null;

  const handleNextSpot = () => {
    if (availableSpots.length > 0) {
      setSpotIndex((prev) => (prev + 1) % availableSpots.length);
    }
  };

  const handlePrevSpot = () => {
    if (availableSpots.length > 0) {
      setSpotIndex(
        (prev) => (prev - 1 + availableSpots.length) % availableSpots.length
      );
    }
  };

  const handleZoneFilterChange = (zoneId: string | null) => {
    setZoneFilter(zoneId);
    setSpotIndex(0);
  };

  const handleQuickSelect = () => {
    if (currentAvailableSpot) {
      setSelectedZone(currentAvailableSpot.zone);
      setSelectedSpot(currentAvailableSpot.spot);
      setConfirmModalOpen(true);
    }
  };

  const handleSpotSelect = (zone: ParkingZone, spot: ParkingSpot) => {
    if (spot.status === "available") {
      setSelectedZone(zone);
      setSelectedSpot(spot);
      setConfirmModalOpen(true);
    }
  };

  const handleReportSpot = (zone: ParkingZone, spot: ParkingSpot) => {
    if (spot.status === "occupied") {
      setSelectedZone(zone);
      setSelectedSpot(spot);
      setReportModalOpen(true);
    }
  };

  const handleConfirmParking = () => {
    if (!selectedZone || !selectedSpot) return;

    setZones((prev) =>
      prev.map((zone) =>
        zone.id === selectedZone.id
          ? {
              ...zone,
              spots: zone.spots.map((spot) =>
                spot.id === selectedSpot.id
                  ? { ...spot, status: "occupied" as const }
                  : spot
              ),
            }
          : zone
      )
    );

    const updatedZone = {
      ...selectedZone,
      spots: selectedZone.spots.map((spot) =>
        spot.id === selectedSpot.id
          ? { ...spot, status: "occupied" as const }
          : spot
      ),
    };

    setUserParking({
      zone: updatedZone,
      spot: { ...selectedSpot, status: "occupied" },
      parkedAt: new Date(),
    });

    setConfirmModalOpen(false);
  };

  const handleReportConfirm = () => {
    if (!selectedZone || !selectedSpot) return;

    setZones((prev) =>
      prev.map((zone) =>
        zone.id === selectedZone.id
          ? {
              ...zone,
              spots: zone.spots.map((spot) =>
                spot.id === selectedSpot.id
                  ? { ...spot, status: "reported" as const }
                  : spot
              ),
            }
          : zone
      )
    );

    setReportModalOpen(false);
  };

  const handleLeaveParking = () => {
    if (!userParking) return;

    setZones((prev) =>
      prev.map((zone) =>
        zone.id === userParking.zone.id
          ? {
              ...zone,
              spots: zone.spots.map((spot) =>
                spot.id === userParking.spot.id
                  ? { ...spot, status: "available" as const }
                  : spot
              ),
            }
          : zone
      )
    );

    setUserParking(null);
  };

  return {
    zones,
    totalStats,
    availableSpots,
    currentAvailableSpot,
    spotIndex,
    zoneFilter,
    userParking,
    selectedZone,
    selectedSpot,
    confirmModalOpen,
    reportModalOpen,
    setConfirmModalOpen,
    setReportModalOpen,
    handleNextSpot,
    handlePrevSpot,
    handleZoneFilterChange,
    handleQuickSelect,
    handleSpotSelect,
    handleReportSpot,
    handleConfirmParking,
    handleReportConfirm,
    handleLeaveParking,
  };
}
