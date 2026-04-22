"""
VenU — root URL configuration.
All app routes are namespaced under /api/.
"""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('users.urls')),
    path('api/venues/', include('venues.urls')),
    path('api/bookings/', include('bookings.urls')),
]
