import { ColorQuery, Image, MatchResult, Point, Region, TextQuery, WindowElementQuery, WindowQuery } from "../objects";
import { WindowInterface } from "./window.interface";

export type RegionResultFindInput = Image | TextQuery;
export type PointResultFindInput = ColorQuery;
export type WindowResultFindInput = WindowQuery;
export type WindowElementResultFindInput = WindowElementQuery;
export type FindInput =
  | RegionResultFindInput
  | WindowResultFindInput
  | PointResultFindInput;
export type FindResult = Region | Point | WindowInterface;

export type WindowCallback = (target: WindowInterface) => void | Promise<void>;
export type MatchResultCallback<TARGET_TYPE> = (
  target: MatchResult<TARGET_TYPE>
) => void | Promise<void>;
export type FindHookCallback =
  | WindowCallback
  | MatchResultCallback<Point>
  | MatchResultCallback<Region>;