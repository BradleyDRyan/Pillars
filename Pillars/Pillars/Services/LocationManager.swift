//
//  LocationManager.swift
//  Squirrel2
//
//  Service for managing location permissions and getting current location
//

import Foundation
import CoreLocation

@MainActor
class LocationManager: NSObject, ObservableObject {
    static let shared = LocationManager()

    @Published var authorizationStatus: CLAuthorizationStatus = .notDetermined
    @Published var currentLocation: CLLocation?
    @Published var locationString: String?
    @Published var locationMetadata: [String: String] = [:]

    private let locationManager = CLLocationManager()
    private let geocoder = CLGeocoder()

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        authorizationStatus = locationManager.authorizationStatus
    }

    func requestPermission() {
        locationManager.requestWhenInUseAuthorization()
    }

    func getCurrentLocation() {
        guard authorizationStatus == .authorizedWhenInUse || authorizationStatus == .authorizedAlways else {
            requestPermission()
            return
        }

        locationManager.requestLocation()
    }

    func getLocationMetadata() -> [String: String] {
        var metadata: [String: String] = [:]

        if let location = currentLocation {
            metadata["latitude"] = "\(location.coordinate.latitude)"
            metadata["longitude"] = "\(location.coordinate.longitude)"
        }

        // Add reverse geocoded data
        metadata.merge(locationMetadata) { _, new in new }

        return metadata
    }

    private func reverseGeocode(location: CLLocation) {
        geocoder.reverseGeocodeLocation(location) { [weak self] placemarks, error in
            guard let self = self,
                  let placemark = placemarks?.first else {
                return
            }

            Task { @MainActor in
                self.locationMetadata = [:]

                if let locality = placemark.locality {
                    self.locationMetadata["locality"] = locality
                }
                if let administrativeArea = placemark.administrativeArea {
                    self.locationMetadata["administrativeArea"] = administrativeArea
                }
                if let country = placemark.country {
                    self.locationMetadata["country"] = country
                }
                if let postalCode = placemark.postalCode {
                    self.locationMetadata["postalCode"] = postalCode
                }

                // Build a display string
                var components: [String] = []
                if let locality = placemark.locality {
                    components.append(locality)
                }
                if let administrativeArea = placemark.administrativeArea {
                    components.append(administrativeArea)
                }
                self.locationString = components.joined(separator: ", ")
            }
        }
    }
}

extension LocationManager: CLLocationManagerDelegate {
    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            self.authorizationStatus = manager.authorizationStatus

            if authorizationStatus == .authorizedWhenInUse || authorizationStatus == .authorizedAlways {
                manager.requestLocation()
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }

        Task { @MainActor in
            self.currentLocation = location
            self.reverseGeocode(location: location)
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("❌ [LocationManager] Failed to get location: \(error)")
    }
}
