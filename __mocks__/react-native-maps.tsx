import React from "react";
import { View } from "react-native";

const MapView = React.forwardRef((_props: any, ref: any) => {
  React.useImperativeHandle(ref, () => ({
    animateToRegion: jest.fn(),
    animateCamera: jest.fn(),
  }));
  return <View testID="map-view" {..._props} />;
});
MapView.displayName = "MapView";

export default MapView;
export const Polygon  = (_props: any) => null;
export const Marker   = (_props: any) => null;
export const Polyline = (_props: any) => null;
