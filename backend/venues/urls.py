from django.urls import path

from .views import (
    VenueAlternativesView,
    VenueDetailView,
    VenueListCreateView,
    VenuePersonnelDetailView,
    VenuePersonnelListCreateView,
    VenueStatsView,
)

urlpatterns = [
    path('', VenueListCreateView.as_view(), name='venue-list-create'),
    path('alternatives/', VenueAlternativesView.as_view(), name='venue-alternatives'),
    path('stats/', VenueStatsView.as_view(), name='venue-stats'),
    path('personnel/', VenuePersonnelListCreateView.as_view(), name='venue-personnel-list-create'),
    path('personnel/<int:pk>/', VenuePersonnelDetailView.as_view(), name='venue-personnel-detail'),
    path('<int:pk>/', VenueDetailView.as_view(), name='venue-detail'),
]
