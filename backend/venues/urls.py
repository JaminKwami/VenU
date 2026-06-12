from django.urls import path

from .views import VenueAlternativesView, VenueDetailView, VenueListCreateView, VenueStatsView

urlpatterns = [
    path('', VenueListCreateView.as_view(), name='venue-list-create'),
    path('alternatives/', VenueAlternativesView.as_view(), name='venue-alternatives'),
    path('stats/', VenueStatsView.as_view(), name='venue-stats'),
    path('<int:pk>/', VenueDetailView.as_view(), name='venue-detail'),
]
